from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image, ImageDraw, ImageFilter
import io
import os
import json
import base64
import numpy as np

app = FastAPI(title="Raw Material AI Vision Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
model = None
class_mapping = {}

model_path = 'models/best_model.pt'
mapping_path = 'models/class_mapping.json'


def load_model():
    global model, class_mapping
    if os.path.exists(model_path) and os.path.exists(mapping_path):
        with open(mapping_path, 'r') as f:
            mapping = json.load(f)
            class_mapping = {int(k): v for k, v in mapping.items()}

        m = models.mobilenet_v2()
        num_ftrs = m.classifier[1].in_features
        m.classifier[1] = nn.Linear(num_ftrs, len(class_mapping))
        m.load_state_dict(torch.load(model_path, map_location=device))
        m = m.to(device)
        m.eval()
        model = m
        return True
    return False


load_model()

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])


def pil_to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')


def generate_gradcam(m, input_tensor: torch.Tensor, orig_image: Image.Image) -> str:
    """
    Generates a Grad-CAM heatmap overlaid on orig_image.
    Works with MobileNetV2 by hooking the last Conv layer in features.
    Returns a base64-encoded PNG string.
    """
    gradients = []
    activations = []

    # Hook the last Conv layer (index 18 in MobileNetV2 features)
    target_layer = m.features[-1]

    def forward_hook(module, input, output):
        activations.append(output.detach())

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0].detach())

    fh = target_layer.register_forward_hook(forward_hook)
    bh = target_layer.register_full_backward_hook(backward_hook)

    # Forward pass with grad enabled
    m.zero_grad()
    inp = input_tensor.clone().requires_grad_(True)
    output = m(inp)
    # Backprop on the predicted class score
    pred_class = output.argmax(dim=1).item()
    output[0, pred_class].backward()

    fh.remove()
    bh.remove()

    if not gradients or not activations:
        # Fallback: return original image
        return pil_to_base64(orig_image)

    # Pool gradients over spatial dimensions -> channel weights
    grad = gradients[0].squeeze(0)           # (C, H, W)
    act = activations[0].squeeze(0)          # (C, H, W)
    weights = grad.mean(dim=(1, 2))          # (C,)

    # Weighted sum of activation maps
    cam = (weights[:, None, None] * act).sum(dim=0)  # (H, W)
    cam = torch.relu(cam)

    # Normalize to [0, 1]
    cam = cam - cam.min()
    if cam.max() > 0:
        cam = cam / cam.max()

    cam_np = cam.cpu().numpy()  # (H, W) float 0-1

    # Resize CAM to match original image
    orig_w, orig_h = orig_image.size
    cam_pil = Image.fromarray((cam_np * 255).astype(np.uint8)).resize(
        (orig_w, orig_h), resample=Image.BILINEAR
    ).filter(ImageFilter.GaussianBlur(radius=6))

    cam_arr = np.array(cam_pil, dtype=np.float32) / 255.0  # (H, W) 0-1

    # Map to RGBA heatmap: cold (blue) -> warm (red)
    heatmap_rgba = np.zeros((orig_h, orig_w, 4), dtype=np.uint8)
    # R channel: high activation
    heatmap_rgba[:, :, 0] = (cam_arr * 255).astype(np.uint8)
    # G channel: mid activation
    heatmap_rgba[:, :, 1] = ((1 - np.abs(cam_arr - 0.5) * 2) * 200).astype(np.uint8)
    # B channel: low activation
    heatmap_rgba[:, :, 2] = ((1 - cam_arr) * 200).astype(np.uint8)
    # Alpha: semi-transparent, stronger where activation is higher
    heatmap_rgba[:, :, 3] = (cam_arr * 180 + 30).astype(np.uint8)

    heatmap_img = Image.fromarray(heatmap_rgba, mode='RGBA')

    # Blend onto original
    base = orig_image.convert('RGBA')
    blended = Image.alpha_composite(base, heatmap_img).convert('RGB')

    # Draw legend label
    draw = ImageDraw.Draw(blended)
    draw.rectangle([(4, 4), (180, 22)], fill=(30, 30, 30, 200))
    draw.text((8, 6), "AI Defect Heatmap (Grad-CAM)", fill=(255, 255, 100))

    return pil_to_base64(blended)


def generate_pixel_anomaly_map(orig_image: Image.Image) -> str:
    """
    Pixel-level colour anomaly detection using HSV analysis.
    Highlights pixels that deviate from a healthy-green reference.
    Works without any trained model.
    Returns a base64-encoded PNG string.
    """
    orig_w, orig_h = orig_image.size
    img_rgb = np.array(orig_image.resize((orig_w, orig_h)), dtype=np.float32)

    # Convert to HSV
    r, g, b = img_rgb[:, :, 0], img_rgb[:, :, 1], img_rgb[:, :, 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    delta = maxc - minc

    v = maxc / 255.0
    s = np.where(maxc > 0, delta / maxc, 0)
    h = np.zeros_like(r)
    mask_r = (maxc == r) & (delta > 0)
    mask_g = (maxc == g) & (delta > 0)
    mask_b = (maxc == b) & (delta > 0)
    h[mask_r] = (60 * ((g[mask_r] - b[mask_r]) / delta[mask_r])) % 360
    h[mask_g] = 60 * ((b[mask_g] - r[mask_g]) / delta[mask_g]) + 120
    h[mask_b] = 60 * ((r[mask_b] - g[mask_b]) / delta[mask_b]) + 240

    # "Healthy green" is roughly H=80..160, S>0.2, V>0.2
    healthy_hue = (h >= 60) & (h <= 170)
    healthy_sat = s > 0.15
    healthy_val = v > 0.15

    is_healthy_pixel = healthy_hue & healthy_sat & healthy_val
    is_anomaly = ~is_healthy_pixel & (v > 0.1)  # exclude very dark/shadow pixels

    # Build overlay: tint anomaly pixels red
    overlay = orig_image.convert('RGBA')
    overlay_arr = np.array(overlay, dtype=np.uint8)

    # Red tint on anomalous pixels
    overlay_arr[is_anomaly, 0] = np.clip(overlay_arr[is_anomaly, 0].astype(int) + 120, 0, 255)
    overlay_arr[is_anomaly, 1] = np.clip(overlay_arr[is_anomaly, 1].astype(int) - 60, 0, 255)
    overlay_arr[is_anomaly, 2] = np.clip(overlay_arr[is_anomaly, 2].astype(int) - 60, 0, 255)
    overlay_arr[is_anomaly, 3] = 230

    result = Image.fromarray(overlay_arr, 'RGBA').convert('RGB')

    # Draw contour boxes around large anomaly clusters (simple grid approach)
    draw = ImageDraw.Draw(result)
    cell = 32
    for y in range(0, orig_h, cell):
        for x in range(0, orig_w, cell):
            patch = is_anomaly[y:y+cell, x:x+cell]
            if patch.mean() > 0.35:  # >35% of patch is anomalous
                draw.rectangle([(x+1, y+1), (x+cell-1, y+cell-1)],
                                outline=(255, 50, 50), width=2)

    # Legend
    draw.rectangle([(4, 4), (210, 22)], fill=(30, 30, 30))
    draw.text((8, 6), "Pixel Anomaly Map (Colour Analysis)", fill=(255, 100, 100))

    return pil_to_base64(result)


@app.post("/api/ai/analyze")
async def analyze_image(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    # Always generate pixel anomaly map (no model needed)
    pixel_map_b64 = generate_pixel_anomaly_map(image)

    if model is None:
        if not load_model():
            return {
                "status": "Requires Training",
                "raw_material_class": "Unknown",
                "condition": "Uncertain",
                "confidence_score": 0.0,
                "detected_defect": "None",
                "visual_qa_result": "REVIEW REQUIRED",
                "ai_model_version": "v0.0 (Untrained)",
                "gradcam_heatmap": None,
                "pixel_anomaly_map": pixel_map_b64
            }

    try:
        input_tensor = transform(image).unsqueeze(0).to(device)

        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            confidence, predicted_idx = torch.max(probabilities, 0)

        confidence_val = confidence.item()
        predicted_class_name = class_mapping[predicted_idx.item()]

        parts = predicted_class_name.split('_')
        material = parts[0].capitalize() if len(parts) > 0 else "Unknown"
        condition = parts[1].capitalize() if len(parts) > 1 else "Unknown"

        qa_result = "PASS"
        if condition.lower() not in ["healthy", "normal"]:
            qa_result = "WARNING" if confidence_val < 0.9 else "CRITICAL"
        if confidence_val < 0.7:
            qa_result = "REVIEW REQUIRED"

        # Generate Grad-CAM only for defective classifications
        gradcam_b64 = None
        if condition.lower() not in ["healthy", "normal"]:
            try:
                gradcam_b64 = generate_gradcam(model, input_tensor.clone(), image)
            except Exception as e:
                print(f"Grad-CAM failed: {e}")

        return {
            "status": "Success",
            "raw_material_class": material,
            "condition": condition,
            "confidence_score": round(confidence_val * 100, 2),
            "detected_defect": condition if condition.lower() not in ["healthy", "normal"] else "None",
            "visual_qa_result": qa_result,
            "ai_model_version": "v1.0 (MobileNetV2 + Grad-CAM)",
            "gradcam_heatmap": gradcam_b64,
            "pixel_anomaly_map": pixel_map_b64
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
