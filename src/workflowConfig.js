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
      description: 'Set the cycle details before employees begin their self assessments.',
      fields: [
        { name: 'reviewTitle', label: 'Review title', type: 'text', required: true, placeholder: 'e.g. Q3 2026 Performance Review' },
        { name: 'reviewPeriod', label: 'Review period', type: 'select', required: true, options: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'] },
        { name: 'department', label: 'Department', type: 'employee', required: true, hint: 'Select department or All' },
        { name: 'reviewType', label: 'Review type', type: 'select', required: true, options: ['Self + Manager', 'Manager only', '360°'] },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
      ],
    },
    configure_kpi: {
      title: 'Configure KPIs',
      description: 'Add the KPIs each employee will be evaluated against.',
      builder: 'kpi',
    },
    self_assessment: {
      title: 'Employee self assessment',
      description: 'Rate yourself against each KPI and add supporting comments.',
      builder: 'assessment',
    },
    supervisor_review: {
      title: 'Supervisor review',
      description: 'Review the employee self assessment and add your ratings.',
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
      description: 'Define the competencies required for each position.',
      builder: 'competencyRequirement',
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
        { name: 'planTitle', label: 'Plan title', type: 'text', required: true },
        { name: 'duration', label: 'Duration (weeks)', type: 'number', required: true },
        { name: 'prioritySkills', label: 'Priority skills', type: 'text', required: true, hint: 'Comma-separated skill names' },
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
        { name: 'newScore', label: 'Updated competency score (%)', type: 'number', required: true, min: 0, max: 100 },
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
      description: 'Set the session details: trainer, venue, date, capacity and budget.',
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'trainer', label: 'Trainer', type: 'text', required: true },
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
    { label: 'Submit nomination', stage: 'submitted', roles: ['employee'] },
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

