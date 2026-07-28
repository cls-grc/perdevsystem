// A single source of truth for allowed stages. The API never accepts a client-supplied stage.
export const WORKFLOWS = {
  performance: [
    ['create_review', 'Create review', ['hr']],
    ['configure_kpi', 'Configure KPI', ['hr']],
    ['notify_employee', 'Notify employee', ['hr']],
    ['self_assessment', 'Self assessment', ['employee']],
    ['supervisor_review', 'Supervisor review', ['supervisor']],
    ['performance_evaluation', 'Performance evaluation', ['supervisor']],
    ['calibration', 'Calibration', ['hr']],
    ['final_approval', 'Final approval', ['hr']],
    ['published', 'Publish results', ['hr']],
  ],
  competency: [
    ['define_requirements', 'Define competency requirements', ['hr']],
    ['manage_resources', 'Manage learning resources', ['hr']],
    ['assign_plan', 'Assign development plan', ['hr', 'supervisor']],
    ['track_progress', 'Track learning progress', ['employee', 'supervisor']],
    ['update_record', 'Update competency record', ['hr']],
  ],
  learning: [
    ['publish_resources', 'Publish learning resources', ['hr']],
    ['enrollment', 'Employee enrollment', ['hr', 'supervisor']],
    ['complete_activities', 'Complete learning activities', ['employee']],
    ['assessment', 'Post-learning assessment', ['employee', 'supervisor']],
    ['update_competency', 'Update competency records', ['hr']],
  ],
  training: [
    ['schedule', 'Schedule training', ['hr']],
    ['invite', 'Invite participants', ['hr', 'supervisor']],
    ['attendance', 'Record attendance', ['employee', 'supervisor', 'hr']],
    ['effectiveness', 'Measure effectiveness', ['employee', 'supervisor']],
    ['published', 'Publish analytics', ['hr']],
  ],
  succession: [
    ['initiate', 'Initiate planning cycle', ['hr']],
    ['nominate', 'Nominate candidates', ['supervisor']],
    ['review_readiness', 'Review readiness assessments', ['hr']],
    ['approved', 'Management approval', ['management']],
  ],
  recognition: [
    ['submitted', 'Submit nomination', ['employee']],
    ['supervisor_validation', 'Supervisor validation', ['supervisor']],
    ['hr_review', 'HR review', ['hr']],
  ],
}

export function stagesFor(module) {
  const stages = WORKFLOWS[module]
  if (!stages) throw Object.assign(new Error('Unsupported workflow module'), { status: 400 })
  return stages
}

export function nextStage(module, currentStage, role) {
  const stages = stagesFor(module)
  const currentIndex = stages.findIndex(([key]) => key === currentStage)
  if (currentIndex < 0) throw Object.assign(new Error('Workflow has an invalid current stage.'), { status: 409 })
  const [, currentLabel, currentRoles] = stages[currentIndex]
  if (!currentRoles.includes(role)) throw Object.assign(new Error(`${currentLabel} must be completed by ${currentRoles.join(' or ')}.`), { status: 403 })
  if (currentIndex === stages.length - 1) return null
  const [key, label, roles] = stages[currentIndex + 1]
  return { key, label, roles }
}
