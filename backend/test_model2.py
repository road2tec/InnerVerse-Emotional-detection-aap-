import tensorflow as tf
from tensorflow import keras
import os
import numpy as np

path = "ml_models/fer2013_model.h5"
if os.path.exists(path):
    print("Loading model from", path)
    try:
        model = keras.models.load_model(path)
        print("Model loaded successfully.")
        x = np.random.rand(1, 48, 48, 1).astype(np.float32)
        proba = model.predict(x)
        print("Random input predictions:", proba)
    except Exception as e:
        print("Failed to load or predict:", e)
else:
    print("Path does not exist.")
