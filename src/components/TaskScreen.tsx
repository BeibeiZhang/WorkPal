import { useState } from 'react';
import { iconAsana, iconClock } from '../assets';
import { FilterChip } from './shared';

interface Task {
  id: string;
  text: string;
  assignee: string;
  due: string;
  status: 'to-do' | 'in-progress' | 'done';
  project: string;
  completed: boolean;
}

const DEMO_TASKS: Task[] = [
  {
    id: '1',
    text: 'Create illustration to explain how to scan an ID',
    assignee: 'Kai',
    due: 'Thursday, April 10',
    status: 'in-progress',
    project: 'Pickup & Drop-off',
    completed: false,
  },
  {
    id: '2',
    text: "Provided the engineers' ETA",
    assignee: 'Stephen',
    due: 'Tomorrow',
    status: 'to-do',
    project: 'Pickup & Drop-off',
    completed: false,
  },
  {
    id: '3',
    text: 'Standardize error messaging for failed ID scans',
    assignee: 'Beibei',
    due: 'Friday, April 11',
    status: 'to-do',
    project: 'Alcohol Delivery',
    completed: false,
  },
  {
    id: '4',
    text: 'Review age verification compliance checklist',
    assignee: 'Kai',
    due: 'Wednesday, April 9',
    status: 'done',
    project: 'Alcohol Delivery',
    completed: true,
  },
  {
    id: '5',
    text: 'Design step-by-step driver ID scanning flow',
    assignee: 'Beibei',
    due: 'Monday, April 7',
    status: 'done',
    project: 'Pickup & Drop-off',
    completed: true,
  },
  {
    id: '6',
    text: 'Set up automated compliance alerts for alcohol delivery',
    assignee: 'Stephen',
    due: 'Friday, April 11',
    status: 'in-progress',
    project: 'Alcohol Delivery',
    completed: false,
  },
];

const STATUS_LABELS: Record<string, string> = {
  'to-do': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
};

const FILTER_CHIPS = ['All', 'To Do', 'In Progress', 'Done'];

function StatusBadge({ status }: { status: Task['status'] }) {
  const styles: Record<string, { bg: string; color: string }> = {
    'to-do': { bg: 'rgba(49,113,255,0.1)', color: '#3171ff' },
    'in-progress': { bg: 'rgba(255,149,0,0.1)', color: '#FF9500' },
    'done': { bg: 'rgba(2,137,1,0.1)', color: '#028901' },
  };
  const s = styles[status];
  return (
    <span
      className="text-sm font-semibold leading-[22px] tracking-[-0.3px] whitespace-nowrap px-[10px] py-1 rounded shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface TaskScreenProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TaskScreen({ sidebarOpen, onToggleSidebar }: TaskScreenProps) {
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS);
  const [activeFilter, setActiveFilter] = useState('All');

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, completed: !t.completed, status: t.completed ? 'to-do' : 'done' }
          : t
      )
    );
  };

  const filtered = activeFilter === 'All'
    ? tasks
    : tasks.filter(t => STATUS_LABELS[t.status] === activeFilter);

  const grouped: Record<string, Task[]> = {};
  filtered.forEach(t => {
    if (!grouped[t.project]) grouped[t.project] = [];
    grouped[t.project].push(t);
  });

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor"/>
              <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
            </svg>
          </button>
        )}
        <div className="flex-1 flex items-center justify-center">
          <h2
            className="text-text-primary font-bold text-[16px] leading-[22px] tracking-[-0.43px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Tasks
          </h2>
        </div>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-8 py-4">
        <div className="max-w-2xl mx-auto">

          {/* Summary row */}
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[28px] font-bold text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                {tasks.filter(t => !t.completed).length}
              </span>
              <span className="text-text-primary text-base">open</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[28px] font-bold text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                {tasks.filter(t => t.completed).length}
              </span>
              <span className="text-text-primary text-base">completed</span>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_CHIPS.map(chip => (
              <FilterChip
                key={chip}
                label={chip}
                active={activeFilter === chip}
                onClick={() => setActiveFilter(chip)}
              />
            ))}
          </div>

          {/* Task groups */}
          {Object.entries(grouped).map(([project, projectTasks]) => (
            <div
              key={project}
              className="border border-stroke-outline rounded-lg overflow-hidden mb-4"
              style={{ background: 'var(--color-bg-page)' }}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 px-4 h-[61px] border-b border-stroke-outline">
                <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                  <img src={iconAsana} alt="" className="w-[18px] h-[18px] object-contain icon-theme" />
                </div>
                <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">
                  {project}
                </p>
                <span className="text-text-primary text-sm">
                  {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Task list */}
              <div className="p-4 flex flex-col gap-3">
                {projectTasks.map((task, i) => (
                  <div key={task.id}>
                    {i > 0 && <div className="border-t border-stroke-outline mb-3" />}
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="w-4 h-4 mt-[3px] shrink-0 border rounded transition-colors"
                        style={{
                          borderColor: task.completed ? '#028901' : '#757575',
                          background: task.completed ? '#028901' : 'var(--color-bg-page)',
                        }}
                      >
                        {task.completed && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8L7 11L12 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-base leading-[22px] ${task.completed ? 'line-through text-text-tertiary' : 'text-text-primary'}`}
                          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                        >
                          <span className="text-[#3171ff]">@{task.assignee}</span>
                          {' '}{task.text}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <img src={iconClock} alt="" className="w-3 h-3 object-contain icon-theme opacity-50" />
                            <span className="text-text-primary text-xs">{task.due}</span>
                          </div>
                        </div>
                      </div>
                      {/* Status */}
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-text-tertiary text-base">
              No tasks match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
