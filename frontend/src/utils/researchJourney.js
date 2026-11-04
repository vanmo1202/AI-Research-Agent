const afterCollection = [
  'collected',
  'analyzing',
  'analyzed',
  'analyzed_partial',
  'generating_report',
  'completed',
];
export function researchJourney({
  status,
  stage = 1,
  planned = false,
  collected = false,
  searching = false,
  analysisStatus,
  evidenceCount = 0,
  reportExists = false,
} = {}) {
  const failed = status === 'failed';
  const partial =
    status !== 'analyzing' &&
    (status === 'analyzed_partial' || analysisStatus === 'analyzed_partial');
  const reportComplete = reportExists || status === 'completed';
  const analysisComplete =
    !partial &&
    (analysisStatus === 'analyzed' ||
      ['analyzed', 'generating_report', 'completed'].includes(status) ||
      evidenceCount > 0);
  const states = [
    planned || (status && status !== 'planning' && !failed)
      ? 'complete'
      : status === 'planning'
        ? 'active'
        : 'pending',
    collected || afterCollection.includes(status)
      ? 'complete'
      : searching || ['searching', 'translating'].includes(status)
        ? 'active'
        : 'pending',
    status === 'analyzing'
      ? 'active'
      : partial
        ? 'partial'
        : analysisComplete
          ? 'complete'
          : 'pending',
    reportComplete ? 'complete' : status === 'generating_report' ? 'active' : 'pending',
  ];
  if (failed) states[stage - 1] = 'failed';
  const labels = [
    {
      complete: 'Đã lập kế hoạch',
      active: 'Đang lập kế hoạch',
      pending: 'Chưa lập kế hoạch',
      failed: 'Lập kế hoạch thất bại',
    },
    {
      complete: 'Đã thu thập',
      active: 'Đang thu thập tài liệu',
      pending: 'Chưa thu thập',
      failed: 'Thu thập thất bại',
    },
    {
      complete: 'Đã phân tích',
      active: 'Đang phân tích',
      partial: 'Hoàn thành một phần',
      pending: 'Chưa phân tích',
      failed: 'Phân tích thất bại',
    },
    {
      complete: 'Đã tạo báo cáo',
      active: 'Đang tạo báo cáo',
      pending: 'Chưa tạo báo cáo',
      failed: 'Tạo báo cáo thất bại',
    },
  ];
  const steps = states.map((state, index) => ({ state, label: labels[index][state] }));
  const first = states.slice(0, 2).includes('failed')
    ? { state: 'failed', label: planned ? 'Thu thập thất bại' : 'Lập kế hoạch thất bại' }
    : states[1] === 'complete'
      ? { state: 'complete', label: 'Đã lập kế hoạch & thu thập' }
      : states.slice(0, 2).includes('active')
        ? steps[states[1] === 'active' ? 1 : 0]
        : { state: 'pending', label: planned ? 'Đã lập kế hoạch · Chưa thu thập' : 'Chưa bắt đầu' };
  const workflowSteps = [first, ...steps.slice(2)];
  return {
    workflowSteps,
    workflowCompleted: workflowSteps.filter((step) => step.state === 'complete').length,
    completed: states.filter((state) => state === 'complete').length,
    steps: states.map((state, index) => ({ state, label: labels[index][state] })),
  };
}
