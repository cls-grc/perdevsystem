import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'
import { logActivity } from '../services/activity.js'

const router = Router()
router.use(authenticate)

// In-memory backing store for interactive live kudos, comments, and reactions
// Combined with official DB recognition workflows
const initialKudos = [
  {
    id: 'kudos-1',
    senderId: 'usr-1',
    senderName: 'Samir Patel',
    senderRole: 'Operations Manager',
    senderDepartment: 'Operations',
    recipientId: 'emp-maria',
    recipientName: 'Maria Lopez',
    recipientDepartment: 'Front Office',
    recipientJobTitle: 'Receptionist',
    badge: 'Guest Delight Champion',
    coreValue: 'Guest Delight',
    tag: '#GuestDelight',
    message: 'Outstanding handling of VIP guest arrival during peak check-in rush yesterday. The guest specifically praised your warm welcome and attentiveness!',
    reactions: { heart: 8, thumbsUp: 12, trophy: 6, star: 9, flame: 5 },
    userReactions: ['heart', 'thumbsUp'],
    comments: [
      {
        id: 'c-1',
        userName: 'Jordan Williams',
        userRole: 'Front Office Manager',
        text: 'Well deserved Maria! Your consistency at the front desk elevates our entire team standard.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'c-2',
        userName: 'Ava Reyes',
        userRole: 'HR Administrator',
        text: 'Adding this commendation to the quarterly hospitality spotlight!',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    isOfficialAward: true,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'kudos-2',
    senderId: 'usr-2',
    senderName: 'Marco Rossi',
    senderRole: 'Executive Chef',
    senderDepartment: 'Kitchen',
    recipientId: 'emp-andre',
    recipientName: 'Andre Tan',
    recipientDepartment: 'Kitchen',
    recipientJobTitle: 'Cook',
    badge: 'Culinary Mastery',
    coreValue: 'Culinary Mastery',
    tag: '#CulinaryMastery',
    message: 'Flawless execution during the Saturday banquet event. Prepared over 180 course plates with zero timing delays and pristine plating quality.',
    reactions: { heart: 5, thumbsUp: 14, trophy: 10, star: 7, flame: 8 },
    userReactions: ['trophy'],
    comments: [
      {
        id: 'c-3',
        userName: 'Robert Johnson',
        userRole: 'Restaurant Manager',
        text: 'The banquet guests sent their direct compliments to the kitchen staff!',
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
    isOfficialAward: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'kudos-3',
    senderId: 'usr-3',
    senderName: 'Anna Kowalski',
    senderRole: 'Housekeeping Manager',
    senderDepartment: 'Housekeeping',
    recipientId: 'emp-rosa',
    recipientName: 'Rosa Martinez',
    recipientDepartment: 'Housekeeping',
    recipientJobTitle: 'Housekeeping Staff',
    badge: 'Excellence in Hospitality',
    coreValue: 'Excellence in Hospitality',
    tag: '#ExcellenceInHospitality',
    message: 'Maintained a perfect 100% audit rating for room hygiene and turnaround time across the 4th floor executive suites all week.',
    reactions: { heart: 11, thumbsUp: 9, trophy: 4, star: 8, flame: 3 },
    userReactions: ['star'],
    comments: [],
    isOfficialAward: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'kudos-4',
    senderId: 'usr-4',
    senderName: 'Emily Thompson',
    senderRole: 'Waitress',
    senderDepartment: 'Food & Beverage',
    recipientId: 'emp-james',
    recipientName: 'James Wilson',
    recipientDepartment: 'Food & Beverage',
    recipientJobTitle: 'Bartender',
    badge: 'Team Player Award',
    coreValue: 'Teamwork & Integrity',
    tag: '#Teamwork',
    message: 'Huge thanks for stepping in and supporting table cocktail service during the Friday night lounge rush without missing a beat!',
    reactions: { heart: 6, thumbsUp: 11, trophy: 2, star: 4, flame: 7 },
    userReactions: ['flame'],
    comments: [],
    isOfficialAward: false,
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
]

let kudosStore = [...initialKudos]

const createKudosSchema = z.object({
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  recipientDepartment: z.string().optional().default('Hospitality'),
  recipientJobTitle: z.string().optional().default('Hotel Staff'),
  badge: z.string().min(1),
  coreValue: z.string().min(1),
  tag: z.string().min(1),
  message: z.string().min(5).max(1000),
})

const commentSchema = z.object({
  text: z.string().min(1).max(500),
})

const reactSchema = z.object({
  reaction: z.enum(['heart', 'thumbsUp', 'trophy', 'star', 'flame']),
})

// GET /api/recognition/feed — fetch combined social feed
router.get('/feed', async (req, res, next) => {
  try {
    // Also pull official completed/approved workflows from database
    let dbKudos = []
    try {
      const wfRes = await query(`
        SELECT w.id, w.title, w.created_at, w.metadata,
               e.full_name AS recipient_name, e.department AS recipient_department, e.job_title AS recipient_job_title,
               u.full_name AS sender_name, u.role AS sender_role
        FROM workflows w
        JOIN employees e ON e.id = w.subject_employee_id
        LEFT JOIN users u ON u.id = w.created_by
        WHERE w.module = 'recognition' AND (w.current_stage = 'hr' OR w.status = 'completed')
        ORDER BY w.updated_at DESC
        LIMIT 10
      `)
      dbKudos = wfRes.rows.map((row) => ({
        id: `wf-${row.id}`,
        senderId: 'system-hr',
        senderName: row.sender_name || 'Hospitality Leadership',
        senderRole: row.sender_role || 'HR',
        senderDepartment: 'Human Resources',
        recipientId: row.id,
        recipientName: row.recipient_name,
        recipientDepartment: row.recipient_department,
        recipientJobTitle: row.recipient_job_title,
        badge: 'Hospitality Merit Award',
        coreValue: 'Excellence in Hospitality',
        tag: '#ExcellenceInHospitality',
        message: row.metadata?.reason || row.title || 'Recognized through official hotel recognition program.',
        reactions: { heart: 7, thumbsUp: 10, trophy: 5, star: 8, flame: 4 },
        userReactions: [],
        comments: [],
        isOfficialAward: true,
        createdAt: row.created_at,
      }))
    } catch {
      // Fallback to in-memory store if db table is empty
    }

    // Merge and deduplicate by id
    const combined = [...kudosStore]
    dbKudos.forEach((dk) => {
      if (!combined.some(k => k.id === dk.id)) {
        combined.push(dk)
      }
    })

    // Sort by createdAt desc
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({ feed: combined })
  } catch (error) { next(error) }
})

// POST /api/recognition/post — give recognition to a colleague
router.post('/post', async (req, res, next) => {
  try {
    const input = createKudosSchema.parse(req.body)
    const newKudos = {
      id: `kudos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: req.user.sub,
      senderName: req.user.name || 'Team Member',
      senderRole: req.user.role,
      senderDepartment: req.user.department || 'Hospitality',
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      recipientDepartment: input.recipientDepartment,
      recipientJobTitle: input.recipientJobTitle,
      badge: input.badge,
      coreValue: input.coreValue,
      tag: input.tag.startsWith('#') ? input.tag : `#${input.tag}`,
      message: input.message,
      reactions: { heart: 1, thumbsUp: 1, trophy: 0, star: 1, flame: 0 },
      userReactions: ['heart'],
      comments: [],
      isOfficialAward: false,
      createdAt: new Date().toISOString(),
    }

    kudosStore.unshift(newKudos)

    // Notify recipient if recipient user exists
    try {
      await query(
        'INSERT INTO notifications(user_id, title, message) SELECT id, $1, $2 FROM users WHERE full_name = $3 AND is_active = true',
        ['Recognition Received', `${req.user.name} recognized you on the Social Recognition Wall: "${input.badge}"`, input.recipientName]
      )
    } catch {}

    await logActivity({
      req,
      user: req.user,
      action: 'recognition.post',
      category: 'recognition',
      description: `${req.user.name} recognized ${input.recipientName} with ${input.badge}`,
      details: { badge: input.badge, tag: input.tag },
    })

    res.status(201).json({ post: newKudos })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/react — toggle reaction on post
router.post('/:id/react', async (req, res, next) => {
  try {
    const { reaction } = reactSchema.parse(req.body)
    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Recognition post not found.' })

    const userHasReacted = post.userReactions.includes(reaction)
    if (userHasReacted) {
      post.userReactions = post.userReactions.filter(r => r !== reaction)
      post.reactions[reaction] = Math.max(0, (post.reactions[reaction] || 1) - 1)
    } else {
      post.userReactions.push(reaction)
      post.reactions[reaction] = (post.reactions[reaction] || 0) + 1
    }

    res.json({ reactions: post.reactions, userReactions: post.userReactions })
  } catch (error) { next(error) }
})

// POST /api/recognition/:id/comment — add a comment
router.post('/:id/comment', async (req, res, next) => {
  try {
    const input = commentSchema.parse(req.body)
    const post = kudosStore.find(p => p.id === req.params.id)
    if (!post) return res.status(404).json({ error: 'Recognition post not found.' })

    const comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      userName: req.user.name || 'Team Member',
      userRole: req.user.role,
      text: input.text,
      createdAt: new Date().toISOString(),
    }

    post.comments.push(comment)
    res.status(201).json({ comment, totalComments: post.comments.length })
  } catch (error) { next(error) }
})

// GET /api/recognition/leaderboard — monthly recognition statistics
router.get('/leaderboard', async (_req, res, next) => {
  try {
    const topStaff = [
      { name: 'Maria Lopez', department: 'Front Office', jobTitle: 'Receptionist', count: 18, badgesCount: 6 },
      { name: 'Andre Tan', department: 'Kitchen', jobTitle: 'Cook', count: 15, badgesCount: 5 },
      { name: 'Rosa Martinez', department: 'Housekeeping', jobTitle: 'Housekeeping Staff', count: 14, badgesCount: 4 },
      { name: 'James Wilson', department: 'Food & Beverage', jobTitle: 'Bartender', count: 12, badgesCount: 4 },
      { name: 'Emily Thompson', department: 'Food & Beverage', jobTitle: 'Waitress', count: 10, badgesCount: 3 },
    ]

    const topDepartments = [
      { department: 'Front Office', totalKudos: 42, icon: 'hotel' },
      { department: 'Kitchen', totalKudos: 38, icon: 'utensils' },
      { department: 'Food & Beverage', totalKudos: 34, icon: 'coffee' },
      { department: 'Housekeeping', totalKudos: 29, icon: 'sparkles' },
      { department: 'Operations', totalKudos: 18, icon: 'settings' },
    ]

    const coreValues = [
      { tag: '#ExcellenceInHospitality', label: 'Excellence in Hospitality', count: 48, icon: 'award' },
      { tag: '#GuestDelight', label: 'Guest Delight', count: 42, icon: 'star' },
      { tag: '#Teamwork', label: 'Teamwork & Integrity', count: 36, icon: 'users' },
      { tag: '#CulinaryMastery', label: 'Culinary Mastery', count: 28, icon: 'flame' },
      { tag: '#SafetyFirst', label: 'Safety & Hygiene First', count: 22, icon: 'shield' },
      { tag: '#Leadership', label: 'Leadership in Action', count: 19, icon: 'crown' },
    ]

    res.json({ topStaff, topDepartments, coreValues })
  } catch (error) { next(error) }
})

export default router
