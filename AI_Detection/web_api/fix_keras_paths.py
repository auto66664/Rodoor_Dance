"""
แก้ไฟล์ .keras ที่เซฟบน Windows ให้โหลดบน Linux ได้ (รันอัตโนมัติตอน docker build)

Keras 2.15 บน Windows เก็บชื่อน้ำหนักโมเดลด้วย "\\" (เช่น layers\\lstm\\cell/vars/0)
บน Linux หาด้วย "/" → โหลดไม่ขึ้น ("lstm_cell expected 3 variables, but received 0")
สคริปต์นี้คัดลอกน้ำหนักทั้งหมดไปไว้ที่ชื่อเดิมแต่ใช้ "/" แทน แล้วเขียนไฟล์ทับ

    python web_api/fix_keras_paths.py models/encoder.keras
"""
import io
import sys
import zipfile

import h5py

WEIGHTS = "model.weights.h5"


def fix(path):
    with zipfile.ZipFile(path) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}

    source = h5py.File(io.BytesIO(files[WEIGHTS]), "r")
    datasets = {}
    source.visititems(lambda name, obj: datasets.update({name: obj[()]}) if isinstance(obj, h5py.Dataset) else None)

    if not any("\\" in name for name in datasets):
        print(f"{path}: ปกติอยู่แล้ว")
        return

    buffer = io.BytesIO()
    with h5py.File(buffer, "w") as target:
        for name, data in datasets.items():
            target.create_dataset(name.replace("\\", "/"), data=data)

        # กลุ่มที่ไม่มีน้ำหนัก (เช่น input_layer/vars, vars) ต้องมีอยู่ด้วย
        groups = []
        source.visititems(lambda name, obj: groups.append(name) if isinstance(obj, h5py.Group) else None)
        for name in groups:
            target.require_group(name.replace("\\", "/"))

    files[WEIGHTS] = buffer.getvalue()

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)

    print(f"{path}: แก้ชื่อน้ำหนัก {len(datasets)} ชุด (\\ → /)")


if __name__ == "__main__":
    for model_path in sys.argv[1:]:
        fix(model_path)
