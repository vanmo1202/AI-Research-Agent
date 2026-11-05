import { Check, ClipboardList, FileSearch, FileText } from 'lucide-react';

const steps=[
  {title:'Lập kế hoạch & Thu thập',description:'Chuẩn bị nguồn',icon:ClipboardList},
  {title:'Phân tích bằng chứng',description:'Kiểm chứng tri thức',icon:FileSearch},
  {title:'Báo cáo',description:'Tổng hợp kết quả',icon:FileText},
];
export default function ResearchStepper({status}){
  const collected=['collected','analyzing','analyzed','analyzed_partial','generating_report','completed'].includes(status);
  const analyzed=['analyzed','analyzed_partial','generating_report','completed'].includes(status);
  const done=status==='completed';
  const states=[collected?'done':'active',analyzed?'done':collected?'active':'pending',done?'done':analyzed?'active':'pending'];
  return <div className="ro-workflow-stepper" aria-label="Tiến trình nghiên cứu">
    {steps.map((step,i)=>{
      const Icon=states[i]==='done'?Check:step.icon;
      return <div className="ro-step-group" key={step.title}>
        {i>0&&<span className={`ro-stepper-line ${states[i-1]==='done'?'done':''}`} aria-hidden="true"/>}
        <div className={`ro-step ${states[i]}`}>
          <span className="ro-step-number"><Icon size={15}/></span>
          <span><strong>{step.title}</strong><small>{states[i]==='done'?'Hoàn thành':states[i]==='active'?'Đang thực hiện':step.description}</small></span>
        </div>
      </div>;
    })}
  </div>;
}
