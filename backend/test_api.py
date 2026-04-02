import requests
import numpy as np
import cv2

img = np.ones((224, 224, 3), dtype=np.uint8) * 200
cv2.imwrite("dummy_face.jpg", img)

files = {'image': open('dummy_face.jpg', 'rb')}
data = {'user_id': 'test', 'age_group': 'adult'}

try:
    res = requests.post("http://localhost:8000/api/emotion/facial", files=files, data=data)
    print("STATUS", res.status_code)
    print("RESPONSE", res.text)
except Exception as e:
    print("FAILED", str(e))
