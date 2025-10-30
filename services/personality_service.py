# services/personality_service.py
"""
Personality Analysis Service
Analyzes videos to predict Big Five personality traits using ResNet50 + LSTM
"""

import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
import os


class PersonalityAnalysisModel(nn.Module):
    """ResNet50 + LSTM model for personality prediction"""
    
    def __init__(self, aggregation='lstm', resnet_version='resnet50'):
        super().__init__()
        
        if resnet_version == 'resnet50':
            resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
            self.feature_dim = 2048
        elif resnet_version == 'resnet18':
            resnet = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
            self.feature_dim = 512
        else:
            raise ValueError(f"Unknown resnet_version: {resnet_version}")
        
        self.feature_extractor = nn.Sequential(*list(resnet.children())[:-1])
        self.aggregation = aggregation
        
        if aggregation == 'lstm':
            # Match training configuration exactly
            self.temporal = nn.LSTM(
                input_size=self.feature_dim,
                hidden_size=256,
                num_layers=2,
                batch_first=True,
                dropout=0.3
            )
            self.fc = nn.Linear(256, 6)
            
        elif aggregation == 'attention':
            self.attention = nn.MultiheadAttention(
                embed_dim=self.feature_dim,
                num_heads=8,
                batch_first=True
            )
            self.fc = nn.Sequential(
                nn.Linear(self.feature_dim, 256),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(256, 6)
            )
        
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, video):
        batch_size, num_frames, c, h, w = video.shape
        frames = video.view(batch_size * num_frames, c, h, w)
        features = self.feature_extractor(frames)
        features = features.view(batch_size, num_frames, self.feature_dim)
        
        if self.aggregation == 'lstm':
            _, (hidden, _) = self.temporal(features)
            aggregated = hidden[-1]  # Last layer's hidden state
            
        elif self.aggregation == 'attention':
            attended, _ = self.attention(features, features, features)
            aggregated = attended.mean(dim=1)
        
        output = self.fc(aggregated)
        return self.sigmoid(output)


class PersonalityAnalysisService:
    """Service for analyzing personality from videos"""
    
    FRAMES_PER_VIDEO = 16
    FRAME_SIZE = 224
    MODEL_PATH = "services/models/resnet_personality_model.pth"
    RESNET_VERSION = "resnet50"
    AGGREGATION = "lstm"
    
    TRAIT_NAMES = [
        "Extraversion",
        "Agreeableness", 
        "Conscientiousness",
        "Neuroticism",
        "Openness",
        "Interview Score"
    ]
    
    TRAIT_DESCRIPTIONS = {
        "Extraversion": {
            "low": "Reserved and thoughtful, prefers working independently",
            "medium": "Balanced between social interaction and independent work",
            "high": "Outgoing and energetic, thrives in collaborative environments"
        },
        "Agreeableness": {
            "low": "Direct and analytical, values honesty over harmony",
            "medium": "Cooperative when needed, maintains professional boundaries",
            "high": "Highly collaborative and empathetic, excellent team player"
        },
        "Conscientiousness": {
            "low": "Flexible and adaptable, comfortable with ambiguity",
            "medium": "Organized when necessary, balances structure and flexibility",
            "high": "Highly organized and detail-oriented, strong work ethic"
        },
        "Neuroticism": {
            "low": "Calm under pressure, emotionally stable and resilient",
            "medium": "Generally stable with normal stress responses",
            "high": "Sensitive and perceptive, deeply invested in work quality"
        },
        "Openness": {
            "low": "Practical and results-focused, values proven methods",
            "medium": "Open to new ideas within structured frameworks",
            "high": "Creative and innovative, embraces new technologies and approaches"
        },
        "Interview Score": {
            "low": "May benefit from interview coaching and practice",
            "medium": "Solid interview performance with clear communication",
            "high": "Excellent presentation skills and professional demeanor"
        }
    }
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None
        self.normalize = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225]),
        ])
        self._load_model()
    
    def _load_model(self):
        print(f"[Personality Service] Loading model on {self.device}...")
        
        self.model = PersonalityAnalysisModel(
            aggregation=self.AGGREGATION,
            resnet_version=self.RESNET_VERSION
        ).to(self.device)
        
        if os.path.exists(self.MODEL_PATH):
            try:
                self.model.load_state_dict(
                    torch.load(self.MODEL_PATH, map_location=self.device)
                )
                print(f"[Personality Service] ✅ Model loaded successfully from {self.MODEL_PATH}")
            except Exception as e:
                print(f"[Personality Service] ❌ Could not load model weights: {e}")
                print("[Personality Service] Using untrained model")
        else:
            print(f"[Personality Service] ⚠️  No model found at {self.MODEL_PATH}")
            print("[Personality Service] Using untrained model")
        
        self.model.eval()
    
    def extract_frames(self, video_path: str) -> np.ndarray:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        indices = np.linspace(0, max(0, total - 1), num=self.FRAMES_PER_VIDEO).astype(int)
        
        frames = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            success, frame = cap.read()
            if not success:
                break
            
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = cv2.resize(frame, (self.FRAME_SIZE, self.FRAME_SIZE))
            frames.append(frame)
        
        cap.release()
        
        if not frames:
            raise ValueError("No frames extracted from video")
        
        while len(frames) < self.FRAMES_PER_VIDEO:
            frames.append(frames[-1].copy())
        
        return np.stack(frames[:self.FRAMES_PER_VIDEO], axis=0)
    
    def get_trait_description(self, trait: str, score: float) -> str:
        if score < 0.4:
            level = "low"
        elif score < 0.6:
            level = "medium"
        else:
            level = "high"
        
        return self.TRAIT_DESCRIPTIONS.get(trait, {}).get(level, "")
    
    def analyze_video(self, video_path: str) -> Dict:
        try:
            frames = self.extract_frames(video_path)
            frames_tensor = torch.stack([self.normalize(f) for f in frames], dim=0)
            frames_tensor = frames_tensor.unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                predictions = self.model(frames_tensor)
                scores = predictions.cpu().numpy()[0]
            
            results = []
            for name, score in zip(self.TRAIT_NAMES, scores):
                percentage = float(score * 100)
                results.append({
                    "trait": name,
                    "score": round(percentage, 1),
                    "raw_score": float(score),
                    "description": self.get_trait_description(name, score),
                    "level": "low" if score < 0.4 else "medium" if score < 0.6 else "high"
                })
            
            return {
                "success": True,
                "results": results
            }
        
        except Exception as e:
            print(f"[Personality Service] Error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


personality_service = PersonalityAnalysisService()