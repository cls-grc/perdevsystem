// ---------------------------------------------------------------------------
// Shared workflow configuration — a single source of truth for how each module
// presents its business interface. The existing WorkflowPage engine, workflow
// engine, APIs, RBAC and DB are reused; this file only shapes WHAT each module
// shows (dashboard widgets, step forms, quick actions) so every module keeps
// its own identity instead of being one same workflow screen.
// ---------------------------------------------------------------------------

// Field type presets used across step forms.
export const FIELD_TYPES = {
  text: true, textarea: true, number: true, date: true, time: true,
  select: true, multiSelect: true, rating: true, toggle: true, money: true,
  fileHint: true, employee: true, link: true,
}

// ---------------------------------------------------------------------------
// Selection-first libraries — templates, dropdown lists, quick comments and
// intelligent defaults so HR rarely needs to type. These power the new
// selection-first field types (templateSelect, kpiLibrary, goalTemplate,
// competencyTemplate, learningTemplate, aiGenerate, quickComments).
// ---------------------------------------------------------------------------

// Intelligent defaults auto-filled into forms (current date / quarter / year /
// reviewer / period) so the only typing left is exceptional customization.
export const INTELLIGENT_DEFAULTS = () => {
  const now = new Date()
  const year = now.getFullYear()
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}') } catch { return {} } })()
  return {
    currentDate: now.toISOString().slice(0, 10),
    currentQuarter: quarter,
    currentYear: String(year),
    nextQuarter: `Q${(Math.floor(now.getMonth() / 3) + 2) % 4 || 1}`,
    period: `${quarter} ${year}`,
    reviewer: role.name || '',
    department: role.department || '',
  }
}

// Dropdown lists so fields become selections instead of free text.
export const REVIEW_TYPES = ['Annual', 'Quarterly', 'Monthly', 'Probation', 'Promotion', 'Special Review']
export const LEARNING_CATEGORIES = ['Leadership', 'Customer Service', 'Food Safety', 'Kitchen Operations', 'Compliance', 'Communication', 'Sales', 'Technical Skills']
export const COMPETENCY_CATEGORIES = ['Technical', 'Behavioral', 'Leadership', 'Communication', 'Management', 'Hospitality Service']
export const TRAINING_CATEGORIES = ['Onboarding', 'Compliance', 'Technical', 'Leadership', 'Service Excellence', 'Safety']
export const RECOGNITION_CATEGORIES = ['Customer Obsession', 'Leadership', 'Innovation', 'Service Excellence', 'Teamwork', 'Safety Champion']
export const COMPETENCY_LEVELS = ['Foundation', 'Developing', 'Proficient', 'Expert']
export const SUCCESSION_READINESS = ['Ready Now', 'Ready in 1-2 Years', 'Potential', 'Not Ready']

// KPI library — selecting one auto-fills name, description, weight, target,
// measurement. HR only adjusts the weight/target values.
export const KPI_LIBRARY = [
  { name: 'Customer Satisfaction', description: 'Overall satisfaction as measured by post-service surveys.', weight: 25, target: '90', measurement: 'Survey score (%)' },
  { name: 'Attendance', description: 'Consistent attendance and punctuality across the period.', weight: 15, target: '95', measurement: 'Attendance rate (%)' },
  { name: 'Food Quality', description: 'Consistency and quality of food output against standards.', weight: 20, target: '90', measurement: 'Quality audit score (%)' },
  { name: 'Service Speed', description: 'Speed of service delivery from order to completion.', weight: 15, target: '85', measurement: 'Avg service time (min)' },
  { name: 'Revenue Target', description: 'Contribution to revenue targets for the period.', weight: 15, target: '100', measurement: 'Revenue achievement (%)' },
  { name: 'Inventory Accuracy', description: 'Accuracy of inventory records and stock levels.', weight: 10, target: '95', measurement: 'Accuracy rate (%)' },
  { name: 'Teamwork', description: 'Collaboration and contribution to team objectives.', weight: 10, target: '90', measurement: 'Peer review score (%)' },
]

// Learning template library — selecting one auto-fills title, description,
// objectives, duration, category. Users only edit if needed.
export const LEARNING_TEMPLATES = [
  { title: 'Leadership Training', category: 'Leadership', duration: '8', description: 'Develop core leadership and people-management capabilities for emerging leaders.', objectives: 'Lead a team effectively; give constructive feedback; delegate and motivate; make decisions with confidence.' },
  { title: 'Customer Service Excellence', category: 'Customer Service', duration: '4', description: 'Deliver memorable, service-first experiences that exceed guest expectations.', objectives: 'Handle guest requests proactively; resolve complaints with empathy; up-sell and cross-sell; maintain service standards.' },
  { title: 'Kitchen Hygiene', category: 'Food Safety', duration: '3', description: 'Maintain strict kitchen hygiene and food-safety standards.', objectives: 'Follow HACCP guidelines; prevent cross-contamination; store food correctly; maintain a clean workstation.' },
  { title: 'Food Safety', category: 'Food Safety', duration: '5', description: 'Understand and apply food-safety regulations across the operation.', objectives: 'Identify food-safety hazards; control critical points; document compliance; respond to incidents.' },
  { title: 'Front Desk Excellence', category: 'Customer Service', duration: '4', description: 'Deliver a polished, professional front-desk experience.', objectives: 'Manage check-in/out smoothly; handle reservations; resolve guest issues; represent the brand.' },
  { title: 'Conflict Resolution', category: 'Communication', duration: '3', description: 'Resolve workplace and guest conflicts constructively.', objectives: 'De-escalate tense situations; listen actively; find win-win outcomes; escalate appropriately.' },
  { title: 'Cash Handling', category: 'Compliance', duration: '2', description: 'Handle cash and POS transactions accurately and securely.', objectives: 'Process payments correctly; reconcile the till; detect fraud; follow cash policies.' },
  { title: 'Emergency Procedures', category: 'Compliance', duration: '2', description: 'Respond correctly to emergencies and safety incidents.', objectives: 'Know evacuation routes; use fire equipment; report incidents; protect guests and staff.' },
]

// Competency template library — selecting a position auto-loads required
// competencies, suggested proficiency levels and weights.
export const COMPETENCY_TEMPLATES = {
  'Restaurant Manager': [
    { competency: 'Operational Management', level: 'Expert', weight: 30 },
    { competency: 'Financial Acumen', level: 'Proficient', weight: 20 },
    { competency: 'Leadership', level: 'Expert', weight: 25 },
    { competency: 'Customer Service', level: 'Proficient', weight: 15 },
    { competency: 'Food Safety', level: 'Proficient', weight: 10 },
  ],
  'Front Desk Officer': [
    { competency: 'Customer Service', level: 'Expert', weight: 30 },
    { competency: 'Communication', level: 'Proficient', weight: 25 },
    { competency: 'Reservation Management', level: 'Proficient', weight: 20 },
    { competency: 'Conflict Resolution', level: 'Developing', weight: 15 },
    { competency: 'Compliance', level: 'Foundation', weight: 10 },
  ],
  'Chef': [
    { competency: 'Culinary Skill', level: 'Expert', weight: 30 },
    { competency: 'Food Safety', level: 'Expert', weight: 25 },
    { competency: 'Kitchen Operations', level: 'Proficient', weight: 20 },
    { competency: 'Team Leadership', level: 'Proficient', weight: 15 },
    { competency: 'Inventory Control', level: 'Developing', weight: 10 },
  ],
  'Waiter': [
    { competency: 'Customer Service', level: 'Proficient', weight: 30 },
    { competency: 'Service Speed', level: 'Proficient', weight: 25 },
    { competency: 'Communication', level: 'Developing', weight: 20 },
    { competency: 'Upselling', level: 'Developing', weight: 15 },
    { competency: 'Food Safety', level: 'Foundation', weight: 10 },
  ],
  'HR Staff': [
    { competency: 'Employee Relations', level: 'Proficient', weight: 25 },
    { competency: 'Recruitment', level: 'Proficient', weight: 20 },
    { competency: 'Compliance', level: 'Proficient', weight: 20 },
    { competency: 'Communication', level: 'Developing', weight: 20 },
    { competency: 'Data & Payroll', level: 'Developing', weight: 15 },
  ],
  'Housekeeping': [
    { competency: 'Room Standards', level: 'Proficient', weight: 30 },
    { competency: 'Hygiene & Safety', level: 'Proficient', weight: 25 },
    { competency: 'Attention to Detail', level: 'Developing', weight: 20 },
    { competency: 'Guest Service', level: 'Developing', weight: 15 },
    { competency: 'Time Management', level: 'Foundation', weight: 10 },
  ],
}

// SMART goal templates for the Goals module — user only edits target numbers.
export const GOAL_TEMPLATES = [
  { name: 'Increase Customer Satisfaction', description: 'Raise customer satisfaction score to the target level this period.', target: '90%', metric: 'Customer satisfaction score', unit: 'percentage' },
  { name: 'Improve Attendance', description: 'Improve attendance and punctuality to the target rate.', target: '95%', metric: 'Attendance rate', unit: 'percentage' },
  { name: 'Reduce Food Waste', description: 'Minimize food waste to the target percentage.', target: '5%', metric: 'Food waste', unit: 'percentage' },
  { name: 'Improve Sales', description: 'Grow sales contribution to the target amount.', target: 'PHP 100,000', metric: 'Sales', unit: 'amount' },
  { name: 'Improve Service Time', description: 'Reduce average service time to the target minutes.', target: '15', metric: 'Avg service time', unit: 'minutes' },
  { name: 'Increase Training Completion', description: 'Boost training completion rate to the target.', target: '90%', metric: 'Training completion', unit: 'percentage' },
]

// Quick comments — clickable chips that build a note without typing.
export const QUICK_COMMENTS = {
  performance: ['Excellent performance', 'Needs coaching', 'Requires training', 'Promotion candidate', 'Leadership potential', 'Attendance concern', 'Customer complaint'],
  competency: ['Strong core competencies', 'Skill gap identified', 'Developing toward target', 'Ready for advanced role', 'Needs focused coaching'],
  learning: ['Completed all activities', 'High engagement', 'Progressing on track', 'Needs extra support', 'Ready for next path'],
  training: ['Attended actively', 'Completed successfully', 'Strong understanding', 'Recommended follow-up', 'High effectiveness'],
  succession: ['Strong leadership potential', 'Ready for succession', 'Needs development', 'High potential', 'Backup needed'],
  recognition: ['Outstanding contribution', 'Excellent customer service', 'Great collaboration', 'Exceeds expectations', 'Deserves recognition'],
}

// AI-generation prompts used by the "Generate using AI" buttons on textareas.
export const AI_GENERATORS = {
  reviewTitle: 'Generate a professional review title for this period.',
  description: 'Generate a clear, professional description.',
  objectives: 'Generate measurable learning objectives.',
  prioritySkills: 'Generate a list of priority skills.',
  coachingNotes: 'Generate coaching notes based on the employees performance.',
  planTitle: 'Generate a development plan title.',
  rationale: 'Generate a nomination rationale.',
  reason: 'Generate a recognition reason.',
  approvalNotes: 'Generate professional approval notes.',
  publishMessage: 'Generate a professional employee notification message.',
  notes: 'Generate professional review notes.',
  reviewNotes: 'Generate professional record notes.',
  validationNotes: 'Generate professional validation notes.',
  hrNotes: 'Generate professional HR notes.',
  trainingObjectives: 'Generate measurable training objectives.',
  feedback: 'Generate constructive performance feedback.',
  reviewSummary: 'Generate a professional review summary.',
  learningRecommendation: 'Generate a learning recommendation.',
  developmentPlan: 'Generate a development plan.',
}

// ---------------------------------------------------------------------------
// PERFORMANCE — Review Cycle · KPI Builder · Scorecards · Calibration · Results
// ---------------------------------------------------------------------------
const performance = {
  module: 'performance',
  title: 'Performance Management',
  description: 'Run a full review cycle: configure KPIs, collect self and manager assessments, calibrate, and publish results.',
  dashboard: {
    heading: 'Review cycle overview',
    widgets: [
      { key: 'activeReviews', label: 'Active Reviews', type: 'count', source: 'workflowsActive' },
      { key: 'pendingReviews', label: 'Pending Reviews', type: 'count', source: 'workflowsPending' },
      { key: 'averageKpi', label: 'Average KPI', type: 'pct', source: 'avgPerformance' },
      { key: 'deptAverage', label: 'Department Average', type: 'pct', source: 'deptAvg' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
    ],
  },
  stepForms: {
create_review: {
      title: 'Create review cycle',
      description: 'Select the employee to evaluate and set the cycle details before they begin their self assessment.',
      fields: [
{ name: 'employee', label: 'Employee to evaluate', type: 'employee', required: true, hint: 'Select the subject of this review cycle' },
        { name: 'reviewTitle', label: 'Review title', type: 'text', required: true, defaultValue: 'Performance Review', hint: 'Auto-generated from period — edit if needed' },
        { name: 'reviewPeriod', label: 'Review period', type: 'select', required: true, options: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'] },
        { name: 'reviewType', label: 'Review type', type: 'select', required: true, options: REVIEW_TYPES },
        { name: 'department', label: 'Department', type: 'select', required: true, options: ['All', 'Front Office', 'Housekeeping', 'Food & Beverage', 'Kitchen', 'Engineering', 'Sales & Marketing', 'Human Resources', 'Finance', 'Security'], hint: 'Select the department for this review cycle' },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
      ],
    },
    configure_kpi: {
      title: 'Configure KPIs',
      description: 'Pick KPIs from the library — each auto-fills name, description, weight and target. Adjust values only if needed.',
      builder: 'kpiLibrary',
    },
self_assessment: {
      title: 'Employee self assessment',
      description: 'Rate yourself against each KPI and add supporting comments.',
      builder: 'assessment',
    },
    performance_evaluation: {
      title: 'Performance evaluation',
      description: 'Enter final ratings, feedback and evidence.',
      builder: 'assessment',
    },
    calibration: {
      title: 'HR calibration',
      description: 'Compare employee and supervisor scores, then approve, reject or return.',
      builder: 'calibration',
    },
    final_approval: {
      title: 'Final approval',
      description: 'Approve the finalized evaluation so results can be published.',
      fields: [
        { name: 'approvalDecision', label: 'Decision', type: 'select', required: true, options: ['Approve', 'Approve with notes', 'Reject'] },
        { name: 'approvalNotes', label: 'Approval notes', type: 'textarea' },
      ],
    },
    published: {
      title: 'Publish results',
      description: 'Publish the review and notify the employee.',
      fields: [
        { name: 'publishToEmployee', label: 'Notify employee', type: 'toggle', required: true },
        { name: 'publishMessage', label: 'Employee message', type: 'textarea' },
      ],
    },
  },
  quickActions: [
    { label: 'Start review cycle', stage: 'create_review', roles: ['hr'] },
    { label: 'Complete self assessment', stage: 'self_assessment', roles: ['employee'] },
  ],
}

// ---------------------------------------------------------------------------
// COMPETENCY — Competency Library · Skill Gap Matrix · Assessment · Dev Plan
// ---------------------------------------------------------------------------
const competency = {
  module: 'competency',
  title: 'Competency Management',
  description: 'Define competency requirements, manage resources, assign development plans and assess the workforce.',
  dashboard: {
    heading: 'Competency overview',
    widgets: [
      { key: 'assessed', label: 'Employees Assessed', type: 'count', source: 'employees' },
      { key: 'avgCompetency', label: 'Average Competency', type: 'pct', source: 'avgCompetency' },
      { key: 'criticalGaps', label: 'Critical Skill Gaps', type: 'count', source: 'gapCount' },
      { key: 'devPlans', label: 'Development Plans', type: 'count', source: 'activeWorkflows' },
    ],
  },
  stepForms: {
define_requirements: {
      title: 'Define competency requirements',
      description: 'Pick a position template to auto-load required competencies, levels and weights.',
      builder: 'competencyTemplate',
    },
    manage_resources: {
      title: 'Manage competency resources',
      description: 'Link learning resources, guides and references to the competency library.',
      builder: 'resources',
    },
    assign_plan: {
      title: 'Assign development plan',
      description: 'Create a development plan addressing each skill gap.',
      fields: [
        { name: 'planTitle', label: 'Plan title', type: 'text', required: true, hint: 'Use AI to draft a title' },
        { name: 'duration', label: 'Duration (weeks)', type: 'number', required: true },
        { name: 'prioritySkills', label: 'Priority skills', type: 'chips', required: true, options: ['Leadership', 'Communication', 'Technical Skills', 'Customer Service', 'Compliance', 'Problem Solving', 'Financial Acumen', 'Teamwork'] },
        { name: 'coachingNotes', label: 'Coaching notes', type: 'textarea' },
      ],
    },
    track_progress: {
      title: 'Track learning progress',
      description: 'Review the employee progress against the plan.',
      builder: 'progress',
    },
    update_record: {
      title: 'Update competency record',
      description: 'Finalize the new competency scores and analytics.',
      fields: [
        { name: 'newScore', label: 'Updated competency score (%)', type: 'slider', required: true, min: 0, max: 100 },
        { name: 'reviewNotes', label: 'Record notes', type: 'textarea' },
      ],
    },
  },
  quickActions: [
    { label: 'Define requirements', stage: 'define_requirements', roles: ['hr'] },
    { label: 'Assign development plan', stage: 'assign_plan', roles: ['hr', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// LEARNING — Learning Catalog · Course Assignment · Progress Tracker
// ---------------------------------------------------------------------------
const learning = {
  module: 'learning',
  title: 'Learning Management',
  description: 'Publish courses, assign learning paths, track completion and measure learning effectiveness.',
  dashboard: {
    heading: 'Learning overview',
    widgets: [
      { key: 'activePaths', label: 'Active Learning Paths', type: 'count', source: 'activeWorkflows' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
      { key: 'overdue', label: 'Overdue Learning', type: 'count', source: 'overdue' },
      { key: 'assigned', label: 'Assigned Courses', type: 'count', source: 'enrollments' },
    ],
  },
  stepForms: {
    publish_resources: {
      title: 'Create learning path',
      description: 'Define the course, category, duration and learning objectives.',
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'category', label: 'Category', type: 'select', required: true, options: ['Leadership', 'Service', 'Safety', 'Operations', 'Compliance'] },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'duration', label: 'Duration (hours)', type: 'number', required: true },
        { name: 'objectives', label: 'Learning objectives', type: 'textarea', required: true },
      ],
    },
    enrollment: {
      title: 'Upload learning materials',
      description: 'Attach PDFs, videos, links and documents for this learning path.',
      builder: 'resources',
    },
    complete_activities: {
      title: 'Assign employees',
      description: 'Assign employees to the learning path.',
      builder: 'assignEmployees',
    },
    assessment: {
      title: 'Track completion',
      description: 'Review each learner progress, completion percentage and last activity.',
      builder: 'progress',
    },
    update_competency: {
      title: 'Generate AI learning insights',
      description: 'After assessment, generate the AI learning insight report.',
      aiOnly: true,
    },
  },
  quickActions: [
    { label: 'Create learning path', stage: 'publish_resources', roles: ['hr'] },
    { label: 'Assign learning', stage: 'complete_activities', roles: ['hr', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// TRAINING — Training Calendar · Session Details · Attendance · Evaluation
// ---------------------------------------------------------------------------
const training = {
  module: 'training',
  title: 'Training Management',
  description: 'Schedule trainings, manage participants, record attendance and evaluate effectiveness.',
  dashboard: {
    heading: 'Training overview',
    widgets: [
      { key: 'upcoming', label: 'Upcoming Trainings', type: 'count', source: 'upcoming' },
      { key: 'attendanceRate', label: 'Attendance Rate', type: 'pct', source: 'attendanceRate' },
      { key: 'completionRate', label: 'Completion Rate', type: 'pct', source: 'completionRate' },
      { key: 'activeSessions', label: 'Active Sessions', type: 'count', source: 'activeWorkflows' },
    ],
  },
  stepForms: {
    schedule: {
      title: 'Create training',
      description: 'Set the session details: venue, date, capacity and budget.',
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'venue', label: 'Venue', type: 'text', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'capacity', label: 'Capacity', type: 'number', required: true, min: 1 },
        { name: 'budget', label: 'Budget', type: 'money', required: true },
      ],
    },
    invite: {
      title: 'Invite participants',
      description: 'Notify assigned employees and supervisors.',
      builder: 'assignEmployees',
    },
    attendance: {
      title: 'Attendance',
      description: 'Record which participants attended the session.',
      builder: 'attendance',
    },
    effectiveness: {
      title: 'Training evaluation',
      description: 'Collect participant feedback and assessment results.',
      builder: 'assessment',
    },
    published: {
      title: 'Generate AI training insights',
      description: 'After evaluation, generate the AI training insight report.',
      aiOnly: true,
    },
  },
  quickActions: [
    { label: 'Schedule training', stage: 'schedule', roles: ['hr'] },
    { label: 'Record attendance', stage: 'attendance', roles: ['hr', 'supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// SUCCESSION — Talent Pool · Readiness Matrix · Candidate Ranking · Pipeline
// ---------------------------------------------------------------------------
const succession = {
  module: 'succession',
  title: 'Succession Planning',
  description: 'Nominate candidates, assess readiness and build the succession pipeline for critical roles.',
  dashboard: {
    heading: 'Succession pipeline',
    widgets: [
      { key: 'readyNow', label: 'Ready Now', type: 'count', source: 'readyNow' },
      { key: 'readySoon', label: 'Ready Soon', type: 'count', source: 'readySoon' },
      { key: 'highPotential', label: 'High Potential', type: 'count', source: 'highPotential' },
      { key: 'criticalPositions', label: 'Critical Positions', type: 'count', source: 'criticalPositions' },
    ],
  },
  stepForms: {
    initiate: {
      title: 'Create succession cycle',
      description: 'Set the planning cycle scope and critical roles.',
      fields: [
        { name: 'cycleTitle', label: 'Cycle title', type: 'text', required: true },
        { name: 'scope', label: 'Scope', type: 'select', required: true, options: ['Department', 'Division', 'Organization'] },
        { name: 'criticalRoles', label: 'Critical roles', type: 'text', required: true, hint: 'Comma-separated role titles' },
      ],
    },
    review_readiness: {
      title: 'Select critical position',
      description: 'Review the talent pool for the selected critical position.',
      builder: 'talentPool',
    },
    nominate: {
      title: 'Nominate candidates',
      description: 'Nominate candidates from your department for succession.',
      builder: 'nominations',
    },
    approved: {
      title: 'Generate AI readiness analysis',
      description: 'After HR review, generate the AI readiness report and management approval.',
      aiOnly: true,
      fields: [
        { name: 'approvalDecision', label: 'Decision', type: 'select', required: true, options: ['Approve', 'Return for revision'] },
      ],
    },
  },
  quickActions: [
    { label: 'Start succession cycle', stage: 'initiate', roles: ['hr'] },
    { label: 'Nominate candidate', stage: 'nominate', roles: ['supervisor'] },
  ],
}

// ---------------------------------------------------------------------------
// RECOGNITION — Recognition Feed · Nomination Form · Leaderboard · History
// ---------------------------------------------------------------------------
const recognition = {
  module: 'recognition',
  title: 'Social Recognition',
  description: 'Submit nominations, validate achievements, approve awards and issue badges automatically.',
  dashboard: {
    heading: 'Recognition overview',
    widgets: [
      { key: 'total', label: 'Total Recognitions', type: 'count', source: 'completed' },
      { key: 'topEmployee', label: 'Most Recognized', type: 'text', source: 'topEmployee' },
      { key: 'deptRecognition', label: 'Department Recognition', type: 'count', source: 'deptRecognition' },
      { key: 'monthly', label: 'Monthly Awards', type: 'count', source: 'monthly' },
    ],
  },
  stepForms: {
    submitted: {
      title: 'Submit nomination',
      description: 'Nominate a colleague with a category, reason and supporting evidence.',
      fields: [
        { name: 'employee', label: 'Employee', type: 'employee', required: true },
        { name: 'category', label: 'Recognition category', type: 'select', required: true, options: ['Customer Obsession', 'Leadership', 'Innovation', 'Service Excellence', 'Teamwork'] },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true },
        { name: 'evidence', label: 'Supporting evidence', type: 'fileHint', required: true, hint: 'Link or description of supporting evidence' },
      ],
    },
    supervisor_validation: {
      title: 'Department head review',
      description: 'Verify the achievement and nomination before HR approval.',
      fields: [
        { name: 'validated', label: 'Validation', type: 'select', required: true, options: ['Validated', 'Return for details'] },
        { name: 'validationNotes', label: 'Validation notes', type: 'textarea' },
      ],
    },
    hr_review: {
      title: 'HR approval',
      description: 'Approve to automatically issue the badge and certificate.',
      fields: [
        { name: 'decision', label: 'Decision', type: 'select', required: true, options: ['Approve & award', 'Reject'] },
        { name: 'badge', label: 'Badge', type: 'select', required: true, options: ['Gold', 'Silver', 'Bronze', 'Excellence Award'] },
        { name: 'hrNotes', label: 'HR notes', type: 'textarea' },
      ],
    },
  },
quickActions: [
    { label: 'Submit nomination', stage: 'submitted', roles: ['employee', 'hr'] },
    { label: 'Review nomination', stage: 'hr_review', roles: ['hr'] },
  ],
}

// ---------------------------------------------------------------------------
// Registry — look up config by module key used by WorkflowPage/ModuleAIInsights
// ---------------------------------------------------------------------------
export const MODULE_CONFIG = { performance, competency, learning, training, succession, recognition }

export function configFor(moduleKey) {
  return MODULE_CONFIG[moduleKey] || { module: moduleKey, title: '', description: '', dashboard: { widgets: [] }, stepForms: {}, quickActions: [] }
}

// ---------------------------------------------------------------------------
// Step guidance — per-stage "current task / required action / estimated time /
// checklist" copy shown in the workflow step guidance card. Falls back to the
// stage description when a stage is not listed here.
// ---------------------------------------------------------------------------
export const STAGE_GUIDES = {
  performance: {
    create_review: { task: 'Set up the review cycle', action: 'Enter cycle details and select scope', time: '~2 min', checklist: ['Add review title', 'Choose period', 'Set due date'] },
    configure_kpi: { task: 'Configure the KPIs', action: 'Add evaluation KPIs and weights', time: '~3 min', checklist: ['Add at least one KPI', 'Set weights', 'Define targets'] },
self_assessment: { task: 'Complete your self assessment', action: 'Rate yourself against each KPI', time: '~5 min', checklist: ['Rate all questions', 'Add supporting comments'] },
    performance_evaluation: { task: 'Complete the evaluation', action: 'Review the self assessment and enter final ratings and evidence', time: '~5 min', checklist: ['Review each KPI', 'Fill final ratings', 'Add evidence'] },
    calibration: { task: 'Calibrate the scores', action: 'Compare and decide', time: '~3 min', checklist: ['Review score gap', 'Choose decision'] },
    final_approval: { task: 'Approve the results', action: 'Approve or reject the finalized review', time: '~1 min', checklist: ['Choose decision', 'Add notes (optional)'] },
    published: { task: 'Publish results', action: 'Notify the employee of the outcome', time: '~1 min', checklist: ['Confirm notification', 'Add message'] },
  },
  competency: {
    define_requirements: { task: 'Define competency requirements', action: 'Add position competency requirements', time: '~3 min', checklist: ['Add requirements', 'Set levels and weights'] },
    manage_resources: { task: 'Link learning resources', action: 'Add references and guides', time: '~2 min', checklist: ['Add resources', 'Provide links'] },
    assign_plan: { task: 'Assign development plan', action: 'Create a plan for the gaps', time: '~2 min', checklist: ['Add plan title', 'Set duration', 'List priority skills'] },
    track_progress: { task: 'Track learning progress', action: 'Review progress against the plan', time: '~2 min', checklist: ['Confirm progress', 'Note any blockers'] },
    update_record: { task: 'Update competency record', action: 'Finalize the new competency score', time: '~1 min', checklist: ['Enter new score', 'Add record notes'] },
  },
  learning: {
    publish_resources: { task: 'Create a learning path', action: 'Add course details and objectives', time: '~3 min', checklist: ['Add title', 'Choose category', 'Set objectives'] },
    enrollment: { task: 'Add learning materials', action: 'Attach resources for the path', time: '~2 min', checklist: ['Add resources', 'Provide links'] },
    complete_activities: { task: 'Assign employees', action: 'Select learners for the path', time: '~2 min', checklist: ['Select employees'] },
    assessment: { task: 'Track completion', action: 'Review learner progress', time: '~2 min', checklist: ['Confirm progress', 'Note completions'] },
    update_competency: { task: 'Generate AI learning insights', action: 'Review the AI report and complete', time: '~1 min', checklist: ['Review AI insights', 'Confirm completion'] },
  },
  training: {
schedule: { task: 'Create a training session', action: 'Set session details', time: '~3 min', checklist: ['Add title', 'Choose venue and date'] },
    invite: { task: 'Invite participants', action: 'Select participants', time: '~2 min', checklist: ['Select participants'] },
    attendance: { task: 'Record attendance', action: 'Mark who attended', time: '~2 min', checklist: ['Mark present / absent'] },
    effectiveness: { task: 'Measure effectiveness', action: 'Collect feedback and results', time: '~3 min', checklist: ['Rate effectiveness', 'Add comments'] },
    published: { task: 'Generate AI training insights', action: 'Review the AI report and complete', time: '~1 min', checklist: ['Review AI insights', 'Confirm completion'] },
  },
  succession: {
    initiate: { task: 'Create a succession cycle', action: 'Set scope and critical roles', time: '~2 min', checklist: ['Add cycle title', 'Choose scope', 'List critical roles'] },
    review_readiness: { task: 'Review candidate readiness', action: 'Select the critical position', time: '~2 min', checklist: ['Review talent pool', 'Select candidates'] },
    nominate: { task: 'Nominate candidates', action: 'Add candidates and rationale', time: '~3 min', checklist: ['Add candidates', 'Provide rationale'] },
    approved: { task: 'Generate AI readiness analysis', action: 'Review the AI report and approve', time: '~1 min', checklist: ['Review AI insights', 'Choose decision'] },
  },
  recognition: {
    submitted: { task: 'Submit a nomination', action: 'Nominate a colleague', time: '~2 min', checklist: ['Select employee', 'Choose category', 'Add reason'] },
    supervisor_validation: { task: 'Validate the nomination', action: 'Verify the achievement', time: '~2 min', checklist: ['Review evidence', 'Choose validation'] },
    hr_review: { task: 'Approve the award', action: 'Approve and issue the badge', time: '~1 min', checklist: ['Choose decision', 'Assign badge'] },
  },
}

// ---------------------------------------------------------------------------
// Comment suggestion chips — quick selectable phrases that build a comment with
// a single click instead of typing. Keyed by module.
// ---------------------------------------------------------------------------
export const COMMENT_SUGGESTIONS = {
  performance: ['Consistently meets targets', 'Excellent communication', 'Strong teamwork', 'Needs improvement in attendance', 'Shows initiative and ownership', 'Areas for growth noted in KPIs'],
  competency: ['Demonstrates strong core competencies', 'Skill gap identified in required area', 'Developing toward target level', 'Ready for advanced responsibility', 'Needs focused coaching'],
  learning: ['Completed all assigned activities', 'High engagement with materials', 'Progressing on track', 'Needs additional support', 'Ready for next learning path'],
  training: ['Attended and participated actively', 'Completed the training successfully', 'Good understanding of content', 'Recommended follow-up session', 'High training effectiveness'],
  succession: ['Strong leadership potential', 'Ready for near-term succession', 'Requires development before readiness', 'High-potential candidate', 'Risk of vacancy without backup'],
  recognition: ['Excellent contribution this period', 'Outstanding customer service', 'Great team collaboration', 'Consistently exceeds expectations', 'Deserves formal recognition'],
}

// ---------------------------------------------------------------------------
// Quick decision presets — one-click approve / reject actions per module with
// the auto-generated note that will be recorded.
// ---------------------------------------------------------------------------
export const QUICK_DECISIONS = {
  performance: { approve: 'Approved by reviewer', reject: 'Returned for revision by reviewer' },
  competency: { approve: 'Approved by reviewer', reject: 'Returned for revision' },
  learning: { approve: 'Approved', reject: 'Returned for revision' },
  training: { approve: 'Approved', reject: 'Returned for revision' },
  succession: { approve: 'Approved', reject: 'Returned for revision' },
  recognition: { approve: 'Approved', reject: 'Rejected' },
}

// Detect whether a workflow stage is an "approval" step. Approval steps should
// present an "Approve & Continue" primary action (plus "Return for Revision")
// instead of the generic "Complete Step", and should not show both together.
const APPROVAL_HINTS = ['approve', 'validat', 'review', 'final_approval', 'hr_review', 'supervisor_validation', 'approved', 'publish']
export function isApprovalStage(stageKey = '', formConfig) {
  const key = String(stageKey || '').toLowerCase()
  if (key && APPROVAL_HINTS.some(hint => key.includes(hint))) return true
  // Heuristic: a form with a required select whose options include "Approve"
  // is treated as an approval decision.
  const fields = formConfig?.fields || []
  return fields.some(field =>
    field.type === 'select' &&
    Array.isArray(field.options) &&
    field.options.some(opt => /approve/i.test(opt)),
  )
}

// Build a module-specific stats object from live API data.
// data = analytics dashboard payload; workflows = workflow list for the module
export function computeModuleStats(moduleKey, data = {}, workflows = []) {
  // `data` can be null when a non-HR role cannot access the analytics endpoint.
  data = data || {}
  const totals = data.totals || {}
  const employees = data.employees || []
  const breakdown = data.workflowBreakdown || []
  const active = workflows.filter(w => w.status === 'active').length
  const completed = workflows.filter(w => w.status === 'completed').length
  const total = active + completed
  const completionRate = total ? Math.round((completed / total) * 100) : 0
  const avgPerformance = Number(totals.average_performance || 0)
  const avgCompetency = Number(totals.average_competency || 0)
  const avgLearning = Number(totals.learning_completion || 0)
  const deptAvgs = employees.reduce((map, e) => {
    map[e.department] = map[e.department] || []
    map[e.department].push(Number(e.performance_score || 0))
    return map
  }, {})
  const deptAvg = Object.keys(deptAvgs).length
    ? Math.round(Object.values(deptAvgs).flat().reduce((s, v) => s + v, 0) / Math.max(1, Object.values(deptAvgs).flat().length))
    : 0
  const countsByStatus = breakdown.filter(b => b.module === moduleKey).reduce((m, r) => { m[r.status] = r.count; return m }, {})
  const completedCount = Number(countsByStatus.completed || 0)
  const activeCount = Number(countsByStatus.active || 0)
  const totalModule = completedCount + activeCount
  const moduleCompletion = totalModule ? Math.round((completedCount / totalModule) * 100) : completionRate

  const pool = {
    workflowsActive: active,
    workflowsPending: active, // pending elsewhere
    activeWorkflows: active,
    avgPerformance,
    avgCompetency,
    avgLearning,
    deptAvg,
    completionRate: moduleCompletion,
    employees: employees.length,
    gapCount: employees.filter(e => Number(e.competency_score || 0) < 70).length,
    activePaths: active,
    assignedCourses: active,
    overdue: 0,
    upcoming: active,
    attendanceRate: moduleCompletion,
    readyNow: employees.filter(e => (e.readiness || '') === 'ready_now').length,
    readySoon: employees.filter(e => (e.readiness || '') === 'ready_in_1_2_years').length,
    highPotential: employees.filter(e => Number(e.performance_score || 0) >= 80 && Number(e.competency_score || 0) >= 80).length,
    criticalPositions: 0,
    completed: completedCount,
    topEmployee: '',
    deptRecognition: completedCount,
    monthly: completedCount,
    totalRecords: employees.length,
    lastUpdated: new Date().toISOString(),
  }
  return pool
}

