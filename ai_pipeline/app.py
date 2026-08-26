from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image
import io
import os
import json

app = FastAPI(title="Raw Material AI Vision Service")

# Allow Node.js backend to call us
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
            # convert string keys to int
            class_mapping = {int(k): v for k, v in mapping.items()}
            
        model = models.mobilenet_v2()
        num_ftrs = model.classifier[1].in_features
        model.classifier[1] = torch.nn.Linear(num_ftrs, len(class_mapping))
        model.load_state_dict(torch.load(model_path, map_location=device))
        model = model.to(device)
        model.eval()
        return True
    return False

# Attempt to load model on startup
load_model()

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

@app.post("/api/ai/analyze")
async def analyze_image(file: UploadFile = File(...)):
    if model is None:
        # Try to load again in case it was just trained
        if not load_model():
            return {
                "status": "Requires Training",
                "raw_material_class": "Unknown",
                "condition": "Uncertain",
                "confidence_score": 0.0,
                "detected_defect": "None",
                "visual_qa_result": "REVIEW REQUIRED",
                "ai_model_version": "v0.0 (Untrained)"
            }
            
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        input_tensor = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            confidence, predicted_idx = torch.max(probabilities, 0)
            
        confidence_val = confidence.item()
        predicted_class_name = class_mapping[predicted_idx.item()]
        
        # Parse the class name, expecting format like "herb_healthy", "leaf_discoloration"
        parts = predicted_class_name.split('_')
        material = parts[0].capitalize() if len(parts) > 0 else "Unknown"
        condition = parts[1].capitalize() if len(parts) > 1 else "Unknown"
        
        qa_result = "PASS"
        if condition.lower() not in ["healthy", "normal"]:
            qa_result = "WARNING" if confidence_val < 0.9 else "CRITICAL"
        if confidence_val < 0.7:
            qa_result = "REVIEW REQUIRED"
            
        return {
            "status": "Success",
            "raw_material_class": material,
            "condition": condition,
            "confidence_score": round(confidence_val * 100, 2),
            "detected_defect": condition if condition.lower() not in ["healthy", "normal"] else "None",
            "visual_qa_result": qa_result,
            "ai_model_version": "v1.0 (MobileNetV2)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
