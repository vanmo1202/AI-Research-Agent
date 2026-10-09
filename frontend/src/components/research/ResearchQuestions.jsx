import { CircleHelp } from 'lucide-react';
import Card from '../ui/Card';
import CopyButton from '../ui/CopyButton';
export default function ResearchQuestions({ questions }) {
  return (
    <Card className="plan-list">
      <div className="panel-heading">
        <h2>
          <span className="heading-icon blue">
            <CircleHelp size={19} />
          </span>
          Research Questions
        </h2>
        <span className="count-badge">{questions.length}</span>
      </div>
      <p className="section-description">Những câu hỏi dẫn dắt quá trình nghiên cứu.</p>
      {questions.length ? (
        <ol>
          {questions.map((item, index) => (
            <li key={item.id}>
              <span className="number-circle">{index + 1}</span>
              <div>
                <small>{item.id}</small>
                <p>{item.question}</p>
              </div>
              <CopyButton text={item.question} label={`Sao chép câu hỏi ${index + 1}`} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted p-5">Chưa có câu hỏi nghiên cứu.</p>
      )}
    </Card>
  );
}
