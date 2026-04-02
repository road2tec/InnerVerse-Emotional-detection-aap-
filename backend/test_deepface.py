import sys
import traceback
import cv2
import numpy as np

try:
    print("Loading DeepFace...")
    from deepface import DeepFace
    print("DeepFace loaded!")
    
    img = np.zeros((224, 224, 3), dtype=np.uint8)
    print("Analyzing image...")
    result = DeepFace.analyze(img, actions=["emotion"], enforce_detection=False)
    print("Analysis Output:", result)
except Exception as e:
    print("DEEPFACE INFERENCE FAILED WITH EXCEPTION:")
    traceback.print_exc()
