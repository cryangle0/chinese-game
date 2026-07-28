const ATTEMPTS: ReadonlyArray<boolean | MediaTrackConstraints> = [
  {
    width: { ideal: 192 }, height: { ideal: 144 },
    frameRate: { ideal: 24 }, facingMode: 'user',
  },
  { facingMode: 'user' },
  true,
];

export async function acquireCameraStream(): Promise<MediaStream> {
  let lastError: unknown;
  for (const video of ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('pose-start-failed');
}

export function cameraFallbackLabel(reason: string): string {
  if (reason === 'NotReadableError') {
    return '摄像头正被其他应用占用，请关闭占用后重试；当前可点击选项作答';
  }
  if (reason === 'NotAllowedError') {
    return '未获得摄像头权限，请在系统设置中授权后重试；当前可点击选项作答';
  }
  if (reason === 'NotFoundError') {
    return '未检测到可用摄像头，请检查设备；当前可点击选项作答';
  }
  if (reason === 'camera-unavailable') {
    return '当前环境不支持体感摄像头，请使用支持 HTTPS 的微信或浏览器；当前可点击选项作答';
  }
  if (reason === 'pose-model-timeout') {
    return '体感模型加载超时，请检查网络后重试；当前可点击选项作答';
  }
  if (reason === 'pose-inference-failed') {
    return '体感识别连续失败，请保持全身入镜后重试；当前可点击选项作答';
  }
  return '体感暂不可用，请重试；当前可点击选项作答';
}
