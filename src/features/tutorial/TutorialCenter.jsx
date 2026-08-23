import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  excelTips,
  exerciseTasks,
  moduleTutorials,
  quickStartTutorial,
} from '../../lib/fixtures/tutorials.ts';
import {
  createTutorialState,
  dismissIntro,
  getTutorialProgress,
  loadTutorialState,
  markExerciseComplete,
  markStepComplete,
  resetTutorialProgress,
  saveTutorialState,
} from './tutorialState.js';
import './TutorialCenter.css';

const LEVEL_LABELS = { 1: '入门', 2: '进阶', 3: '汇报实战' };

function ProgressRing({ progress }) {
  const percent = Math.round(progress * 100);
  return (
    <div className="tutorial-progress-ring" style={{ '--tutorial-progress': `${percent * 3.6}deg` }} aria-label={`教程完成度 ${percent}%`}>
      <span>{percent}%</span>
    </div>
  );
}

function QuickStart({ state, onCompleteStep, onDismiss }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const step = quickStartTutorial[activeIndex];
  const complete = state.completedSteps.includes(step.id);
  const isLast = activeIndex === quickStartTutorial.length - 1;

  return (
    <section className="tutorial-hero tutorial-glass-card" aria-labelledby="quick-start-title">
      <div className="tutorial-hero-copy">
        <span className="tutorial-eyebrow"><Sparkles size={13} /> 5 分钟快速上手</span>
        <h2 id="quick-start-title">从导入表格到导出简报</h2>
        <p>按步骤走一遍，之后每周可以复制项目配置，减少重复操作。</p>
        <div className="tutorial-step-pills" aria-label="快速引导步骤">
          {quickStartTutorial.map((item, index) => (
            <button
              className={`tutorial-step-pill ${index === activeIndex ? 'is-active' : ''} ${state.completedSteps.includes(item.id) ? 'is-done' : ''}`}
              key={item.id}
              onClick={() => setActiveIndex(index)}
              aria-label={`第 ${index + 1} 步：${item.title}`}
            >
              {state.completedSteps.includes(item.id) ? <Check size={12} /> : index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="tutorial-current-step">
        <div className="tutorial-step-heading"><span>第 {activeIndex + 1} 步</span><strong>{step.title}</strong></div>
        <p>{step.body}</p>
        <div className="tutorial-step-actions">
          <button className="tutorial-primary-button" onClick={() => onCompleteStep(step.id)}>
            {complete ? <Check size={15} /> : <Play size={14} />}
            {complete ? '已完成' : step.actionLabel || '标记完成'}
          </button>
          {!isLast ? <button className="tutorial-text-button" onClick={() => setActiveIndex((index) => index + 1)}>下一步 <ChevronRight size={15} /></button> : null}
          <button className="tutorial-dismiss-button" onClick={onDismiss}>稍后再看</button>
        </div>
      </div>
    </section>
  );
}

function ExerciseCard({ task, completed, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={`tutorial-exercise-card tutorial-glass-card ${completed ? 'is-complete' : ''}`}>
      <button className="tutorial-exercise-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="tutorial-exercise-level">L{task.level}</span>
        <span className="tutorial-exercise-main"><strong>{task.title}</strong><small>{task.goal}</small></span>
        <span className="tutorial-exercise-time"><Clock3 size={13} /> {task.estimatedMinutes} 分钟</span>
        {completed ? <span className="tutorial-completed-mark"><Check size={14} /></span> : <ChevronRight className={expanded ? 'is-rotated' : ''} size={17} />}
      </button>
      {expanded ? (
        <div className="tutorial-exercise-detail">
          <ol>{task.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p className="tutorial-outcome"><strong>完成标准：</strong>{task.expectedOutcome}</p>
          <div className="tutorial-skill-list">{task.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          <button className="tutorial-secondary-button" onClick={() => onComplete(task.id)}>{completed ? '已完成练习' : '标记练习完成'} <Check size={14} /></button>
        </div>
      ) : null}
    </article>
  );
}

function ModuleTutorials({ module = 'analysis', state, onCompleteStep }) {
  const steps = moduleTutorials[module] || moduleTutorials.analysis;
  return (
    <section className="tutorial-section">
      <div className="tutorial-section-heading"><div><span className="tutorial-section-kicker">按模块查看</span><h2>工作流小提示</h2></div><BookOpen size={20} /></div>
      <div className="tutorial-module-list">
        {steps.map((step) => {
          const done = state.completedSteps.includes(step.id);
          return <button className={`tutorial-module-row ${done ? 'is-done' : ''}`} key={step.id} onClick={() => onCompleteStep(step.id)}><span>{done ? <Check size={14} /> : <Lightbulb size={14} />}</span><span><strong>{step.title}</strong><small>{step.body}</small></span><ChevronRight size={15} /></button>;
        })}
      </div>
    </section>
  );
}

export default function TutorialCenter({ module = 'analysis', storage, onStartSampleData, onNavigate }) {
  const [state, setState] = useState(() => loadTutorialState(storage));
  const [level, setLevel] = useState('all');
  const [showAllTips, setShowAllTips] = useState(false);

  useEffect(() => saveTutorialState(state, storage), [state, storage]);

  const progress = useMemo(() => getTutorialProgress(state, { stepCount: quickStartTutorial.length, exerciseCount: exerciseTasks.length }), [state]);
  const visibleExercises = level === 'all' ? exerciseTasks : exerciseTasks.filter((task) => task.level === Number(level));
  const visibleTips = showAllTips ? excelTips : excelTips.slice(0, 2);

  const completeStep = (id) => setState((current) => markStepComplete(current, id));
  const completeExercise = (id) => setState((current) => markExerciseComplete(current, id));
  const reset = () => setState(resetTutorialProgress());

  return (
    <main className="tutorial-center" data-testid="tutorial-center">
      <header className="tutorial-page-header">
        <div><span className="tutorial-eyebrow"><GraduationCap size={14} /> 新手友好</span><h1>教程与帮助</h1><p>边做边学，把一次分析变成可复用的工作方法。</p></div>
        <div className="tutorial-header-progress"><ProgressRing progress={progress} /><span>整体学习进度<br /><strong>{state.completedExercises.length} / {exerciseTasks.length} 个练习</strong></span></div>
      </header>

      {!state.dismissedIntro ? <QuickStart state={state} onCompleteStep={completeStep} onDismiss={() => setState((current) => dismissIntro(current))} /> : (
        <section className="tutorial-resume-banner tutorial-glass-card"><span><Sparkles size={16} /> 快速引导已暂时收起</span><button className="tutorial-text-button" onClick={() => setState((current) => ({ ...current, dismissedIntro: false }))}>重新打开</button></section>
      )}

      <div className="tutorial-content-grid">
        <section className="tutorial-section"><div className="tutorial-section-heading"><div><span className="tutorial-section-kicker">分级练习</span><h2>用模拟数据练习</h2></div><button className="tutorial-reset-button" onClick={reset}><RotateCcw size={13} /> 重置进度</button></div>
          <div className="tutorial-level-tabs" role="tablist" aria-label="练习难度"><button className={level === 'all' ? 'is-active' : ''} onClick={() => setLevel('all')}>全部</button>{[1, 2, 3].map((item) => <button className={level === String(item) ? 'is-active' : ''} key={item} onClick={() => setLevel(String(item))}>L{item} · {LEVEL_LABELS[item]}</button>)}</div>
          <div className="tutorial-exercise-list">{visibleExercises.map((task) => <ExerciseCard key={task.id} task={task} completed={state.completedExercises.includes(task.id)} onComplete={completeExercise} />)}</div>
        </section>
        <aside className="tutorial-side-column">
          <ModuleTutorials module={module} state={state} onCompleteStep={completeStep} />
          <section className="tutorial-section"><div className="tutorial-section-heading"><div><span className="tutorial-section-kicker">Excel 小抄</span><h2>随时复习</h2></div><Lightbulb size={20} /></div><div className="tutorial-tips-list">{visibleTips.map((tip) => <article className="tutorial-tip-card" key={tip.id}><strong>{tip.title}</strong><p>{tip.body}</p><code>{tip.example}</code></article>)}</div><button className="tutorial-text-button tutorial-more-button" onClick={() => setShowAllTips((value) => !value)}>{showAllTips ? '收起技巧' : '查看全部技巧'} <ChevronRight size={14} /></button></section>
          <section className="tutorial-sop-card tutorial-glass-card"><BookOpen size={20} /><div><strong>完整使用 SOP</strong><p>后续可将这套引导、常见错误和排查方法整理到任意办公文档。</p><button className="tutorial-secondary-button" onClick={() => onNavigate?.('周报与报告')}>查看报告模板 <ChevronRight size={14} /></button></div></section>
        </aside>
      </div>
      {onStartSampleData ? <button className="tutorial-floating-sample" onClick={onStartSampleData}><Sparkles size={15} /> 用示例数据开始练习</button> : null}
    </main>
  );
}
