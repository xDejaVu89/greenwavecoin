# -*- mode: python ; coding: utf-8 -*-
# GreenWaveCoin Worker — PyInstaller build spec
# Build with: pyinstaller gwc_worker.spec

block_cipher = None

a = Analysis(
    ['gwc_worker_gui.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'tkinter.scrolledtext',
        'tkinter.messagebox',
        'requests',
        'numpy',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch',          # exclude torch — numpy fallback is used if torch not present
        'matplotlib',
        'scipy',
        'pandas',
        'PIL',
        'cv2',
        'sklearn',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='GreenWaveCoin-Worker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # no console window — GUI only
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='gwc_icon.ico',    # optional icon — ignored if file missing
    version='version_info.txt',  # optional version info — ignored if missing
)
