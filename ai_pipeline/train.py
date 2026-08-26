import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt
import copy

def train_model():
    data_dir = 'dataset'
    model_dir = 'models'
    
    train_dir = os.path.join(data_dir, 'train')
    if not os.path.exists(train_dir) or len(os.listdir(train_dir)) == 0:
        print("Error: No training data found in", train_dir)
        return
        
    data_transforms = {
        'train': transforms.Compose([
            transforms.RandomResizedCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    image_datasets = {x: datasets.ImageFolder(os.path.join(data_dir, x), data_transforms[x])
                      for x in ['train', 'val'] if os.path.exists(os.path.join(data_dir, x))}
    
    dataloaders = {x: DataLoader(image_datasets[x], batch_size=32, shuffle=True, num_workers=2)
                   for x in image_datasets.keys()}
    
    dataset_sizes = {x: len(image_datasets[x]) for x in image_datasets.keys()}
    class_names = image_datasets['train'].classes
    
    with open(os.path.join(model_dir, 'class_mapping.json'), 'w') as f:
        json.dump({i: name for i, name in enumerate(class_names)}, f)
    
    device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
    model = models.mobilenet_v2(pretrained=True)
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.SGD(model.parameters(), lr=0.001, momentum=0.9)
    
    num_epochs = 10
    best_model_wts = copy.deepcopy(model.state_dict())
    best_acc = 0.0
    
    for epoch in range(num_epochs):
        for phase in ['train', 'val']:
            if phase not in dataloaders: continue
            if phase == 'train': model.train()
            else: model.eval()

            running_loss, running_corrects = 0.0, 0
            for inputs, labels in dataloaders[phase]:
                inputs, labels = inputs.to(device), labels.to(device)
                optimizer.zero_grad()
                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)
                    if phase == 'train':
                        loss.backward()
                        optimizer.step()
                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

            epoch_acc = running_corrects.double() / dataset_sizes[phase]
            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = copy.deepcopy(model.state_dict())

    model.load_state_dict(best_model_wts)
    torch.save(model.state_dict(), os.path.join(model_dir, 'best_model.pt'))

if __name__ == '__main__':
    train_model()
