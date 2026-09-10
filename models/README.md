# V-DOCKX Vision Models Directory

This directory stores deep learning model weights and configuration files for semantic obstacle detection.

## Supported Models

### 1. MobileNet-SSD (Recommended for Hackathon CPU Execution)
- `MobileNetSSD_deploy.prototxt`: Network definition.
- `MobileNetSSD_deploy.caffemodel`: Pre-trained weights (20 Pascal VOC classes).

To download the weights automatically via PowerShell:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/voc/MobileNetSSD_deploy.prototxt" -OutFile "models/MobileNetSSD_deploy.prototxt"
Invoke-WebRequest -Uri "https://github.com/chuanqi305/MobileNet-SSD/blob/master/MobileNetSSD_deploy.caffemodel?raw=true" -OutFile "models/MobileNetSSD_deploy.caffemodel"
```

## Zero-Crash Offline Fallback
If model weights are not downloaded on the machine, `docking/obstacle_ai.py` automatically falls back to an offline heuristic/mock detector. This ensures the system runs seamlessly in testing, development, and unit test environments without external network dependencies.
