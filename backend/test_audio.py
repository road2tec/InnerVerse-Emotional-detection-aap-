import librosa
try:
    import audioread
    print("audioread version:", audioread.__version__)
    print("audioread available backends:", audioread.available_backends())
except Exception as e:
    print("audioread error:", e)
