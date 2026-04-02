import tensorflow as tf
from tensorflow import keras
import os

path = "dataset/face emotion.h5"
if os.path.exists(path):
    print("Loading model...")
    model = keras.models.load_model(path)
    print("Model input shape:", model.input_shape)
else:
    print("Model file not found!")
