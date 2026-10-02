import { query, pool } from '../src/db.js'

function generateQuizForCourse(course) {
  const title = course.title.toLowerCase()
  const cat = (course.category || '').toLowerCase()
  const desc = (course.description || '').toLowerCase()

  // 1. Food Safety & Kitchen Hygiene
  if (title.includes('food safety') || title.includes('hygiene') || title.includes('haccp') || cat.includes('food safety') || cat.includes('culinary')) {
    return [
      {
        id: 'q1',
        question: 'Under HACCP and food safety standards, what is the "Temperature Danger Zone" where bacteria multiply most rapidly?',
        options: ['0°F to 32°F (-18°C to 0°C)', '41°F to 135°F (5°C to 57°C)', '140°F to 180°F (60°C to 82°C)', '200°F to 250°F (93°C to 121°C)'],
        correctIndex: 1,
        explanation: 'The food temperature danger zone is between 41°F and 135°F (5°C to 57°C), where bacteria multiply exponentially within hours.'
      },
      {
        id: 'q2',
        question: 'What is the minimum safe internal cooking temperature for poultry and stuffed meats?',
        options: ['145°F (63°C) for 15 seconds', '155°F (68°C) for 17 seconds', '165°F (74°C) for 15 seconds', '180°F (82°C) for 10 seconds'],
        correctIndex: 2,
        explanation: 'Poultry products must be cooked to an internal temperature of at least 165°F (74°C) to eliminate harmful pathogens like Salmonella.'
      },
      {
        id: 'q3',
        question: 'What does the inventory management acronym FIFO stand for in professional kitchen storage?',
        options: ['Fast In, Fast Out', 'First In, First Out', 'Food Inspection For Outlets', 'Final Inventory First Order'],
        correctIndex: 1,
        explanation: 'FIFO (First In, First Out) ensures older inventory is rotated and utilized first before newer stock to prevent spoilage.'
      },
      {
        id: 'q4',
        question: 'To prevent cross-contamination, which cutting board color is standard for raw poultry?',
        options: ['Red (raw red meat)', 'Yellow (raw poultry)', 'Green (produce & fruit)', 'Blue (raw seafood)'],
        correctIndex: 1,
        explanation: 'Standard hospitality sanitation designates yellow cutting boards specifically for raw poultry.'
      }
    ]
  }

  // 2. Front Desk, Reservation & Guest Relations
  if (title.includes('front desk') || title.includes('concierge') || title.includes('reservation') || title.includes('guest') || cat.includes('front office') || cat.includes('guest relations')) {
    return [
      {
        id: 'q1',
        question: 'When resolving a guest grievance at the front desk, what is the recommended service recovery framework?',
        options: [
          'Argue, Defend, Explain, Dismiss',
          'Listen, Empathize, Apologize, Solve, Thank (LAST)',
          'Immediately transfer to hotel general manager',
          'Offer refund without listening to details'
        ],
        correctIndex: 1,
        explanation: 'The LAST model (Listen, Empathize, Apologize, Solve, Thank) is the gold standard for guest conflict de-escalation.'
      },
      {
        id: 'q2',
        question: 'During VIP guest check-in, what is the top priority for front office staff according to hotel SOP?',
        options: [
          'Ask for payment in advance loudly',
          'Verify pre-registration details, acknowledge loyalty status, and offer personalized escort',
          'Notify them of late checkout fees',
          'Require them to wait in the regular lobby queue'
        ],
        correctIndex: 1,
        explanation: 'VIP protocol requires discreet pre-arrival preparation, immediate status recognition, and personalized welcoming.'
      },
      {
        id: 'q3',
        question: 'What step should be taken immediately if a guest room is reported as "Double Booked" upon check-in?',
        options: [
          'Inform the guest it is their mistake',
          'Apologize sincerely, hold current guest in lounge, and immediately coordinate room reassignment or complimentary upgrade',
          'Ask both parties to share the room',
          'Cancel the reservation without alternative'
        ],
        correctIndex: 1,
        explanation: 'Immediate proactive service recovery with alternative superior accommodations restores guest trust.'
      },
      {
        id: 'q4',
        question: 'How should confidential guest credit card and personal contact information be protected under data compliance standards?',
        options: [
          'Written on sticky notes at the reception desk',
          'Masked in the PMS with restricted user access and never stored in plain text',
          'Shared in department email threads',
          'Kept in open logbooks'
        ],
        correctIndex: 1,
        explanation: 'PCI-DSS and data privacy require masking payment details and restricting access strictly to authorized personnel.'
      }
    ]
  }

  // 3. Housekeeping, Chemical Safety & Room Standards
  if (title.includes('housekeeping') || title.includes('room standards') || title.includes('chemical') || title.includes('linen') || cat.includes('housekeeping')) {
    return [
      {
        id: 'q1',
        question: 'What is the correct ergonomic and sanitary direction when cleaning a guest room?',
        options: [
          'Bottom to top, dirty to clean',
          'Top to bottom, cleanest areas to dirtiest areas (bathroom last)',
          'Bathroom first, then dusting ceiling',
          'Random order depending on room clutter'
        ],
        correctIndex: 1,
        explanation: 'Cleaning top to bottom and cleanest to dirtiest prevents re-soiling cleaned areas and avoids cross-contamination.'
      },
      {
        id: 'q2',
        question: 'Where should Safety Data Sheets (SDS) for housekeeping chemicals be kept?',
        options: [
          'Locked in HR files only',
          'Immediately accessible to all staff in the chemical storage and housekeeping pantry',
          'At the supplier warehouse',
          'Only available upon formal request'
        ],
        correctIndex: 1,
        explanation: 'OSHA regulations mandate SDS must be immediately accessible to all workers handling hazardous chemicals.'
      },
      {
        id: 'q3',
        question: 'Why should chlorine bleach never be mixed with ammonia-based cleaners?',
        options: [
          'It creates a pleasant fragrance',
          'It neutralizes cleaning effectiveness without harm',
          'It produces lethal chloramine gas that causes severe respiratory injury',
          'It stains tile grout yellow'
        ],
        correctIndex: 2,
        explanation: 'Mixing bleach with ammonia releases deadly chloramine toxic fumes and is strictly prohibited in housekeeping operations.'
      },
      {
        id: 'q4',
        question: 'When inspecting bed linens, which criteria requires immediate rejection and re-laundering?',
        options: [
          'Any visible stain, hair, tear, or residual odor',
          'Crisp ironed folds',
          'High thread count',
          'Hospitality corner folding'
        ],
        correctIndex: 0,
        explanation: 'Hotel inspection standards demand 100% spotless, tear-free, and odorless linens for incoming guests.'
      }
    ]
  }

  // 4. POS, Cash Handling & Financial Acumen
  if (title.includes('cash') || title.includes('pos') || title.includes('financial') || title.includes('revenue') || title.includes('audit')) {
    return [
      {
        id: 'q1',
        question: 'What is the required standard procedure at shift end when closing a cash drawer?',
        options: [
          'Count cash in public view at the counter',
          'Perform a blind count in a secure back-office location and reconcile against PMS/POS shift audit reports',
          'Take surplus cash home',
          'Leave drawer open for the next shift to balance'
        ],
        correctIndex: 1,
        explanation: 'Dual-control blind cash reconciliation in a secure area prevents discrepancies and protects cashiers from liability.'
      },
      {
        id: 'q2',
        question: 'If a cash register has an unexplained discrepancy exceeding the allowable variance threshold, what must happen?',
        options: [
          'Ignore it if it is under $50',
          'Immediately notify the shift supervisor and document an Incident Variance Report',
          'Cover the difference from personal funds without reporting',
          'Adjust sales figures to match the money'
        ],
        correctIndex: 1,
        explanation: 'Variance reporting is mandatory under internal audit controls to detect errors or policy breaches immediately.'
      },
      {
        id: 'q3',
        question: 'What is the purpose of the Night Audit process in hospitality management?',
        options: [
          'To clean the lobby floor',
          'To close the business day, roll the date, post room & tax charges, and reconcile hotel-wide revenue accounts',
          'To turn off the hotel internet',
          'To check in all future reservations'
        ],
        correctIndex: 1,
        explanation: 'Night Audit balances departmental accounts, verifies transactions, posts room and tax, and transitions system to the new business day.'
      },
      {
        id: 'q4',
        question: 'In food & beverage cost control, what does Cost of Goods Sold (COGS) represent?',
        options: [
          'Total server payroll cost',
          'Beginning Inventory + Purchases - Ending Inventory',
          'Total menu price divided by guest count',
          'Cost of utility bills'
        ],
        correctIndex: 1,
        explanation: 'COGS = (Beginning Inventory + Purchases - Ending Inventory) determines the exact direct cost of items sold.'
      }
    ]
  }

  // 5. Leadership, Coaching & Supervision
  if (title.includes('leadership') || title.includes('supervision') || title.includes('team') || title.includes('rostering') || cat.includes('leadership')) {
    return [
      {
        id: 'q1',
        question: 'When delivering constructive feedback to an employee, what is the best leadership practice?',
        options: [
          'Criticize them publicly during team lineup to set an example',
          'Address specific observed behaviors privately, explain the operational impact, and co-create an improvement action plan',
          'Wait until annual appraisal 10 months later',
          'Send an anonymous group email'
        ],
        correctIndex: 1,
        explanation: 'Effective leadership delivers timely, private, behavior-focused feedback with clear collaborative solutions.'
      },
      {
        id: 'q2',
        question: 'What is the primary factor a supervisor must consider when creating a departmental shift roster?',
        options: [
          'Only personal staff preferences regardless of occupancy',
          'Forecasted guest occupancy and volume trends balanced against labor budgets and employee rest regulations',
          'Scheduling everyone on weekends',
          'Leaving stations uncovered to save money'
        ],
        correctIndex: 1,
        explanation: 'Optimized rostering balances forecasted customer volume with budget compliance and labor statutory rest limits.'
      },
      {
        id: 'q3',
        question: 'In situational leadership, what style is most effective for an experienced, highly competent team member?',
        options: [
          'Micromanagement with constant inspection',
          'Empowerment and delegation with supportive coaching as needed',
          'Total neglect without goals',
          'Strict disciplinary monitoring'
        ],
        correctIndex: 1,
        explanation: 'High-competence employees excel when given autonomy, clear goals, and supportive coaching rather than micromanagement.'
      },
      {
        id: 'q4',
        question: 'How should a supervisor handle an interdepartmental operational bottleneck between Kitchen and Service staff?',
        options: [
          'Blame the kitchen staff in front of diners',
          'Facilitate a joint debrief with sous chef and floor supervisor to establish clear expediting signals and communication norms',
          'Ignore the delays as normal industry friction',
          'Tell service staff to refuse taking orders'
        ],
        correctIndex: 1,
        explanation: 'Cross-functional collaboration and standardizing expediting protocols eliminate operational bottlenecks permanently.'
      }
    ]
  }

  // 6. Safety, Security & Emergency Procedures
  if (title.includes('emergency') || title.includes('safety') || title.includes('security') || title.includes('osha')) {
    return [
      {
        id: 'q1',
        question: 'What does the acronym PASS stand for when operating a portable fire extinguisher?',
        options: [
          'Point, Aim, Spray, Stop',
          'Pull pin, Aim at base of fire, Squeeze handle, Sweep side-to-side',
          'Press, Alert, Step back, Secure',
          'Protect, Assess, Signal, Safe'
        ],
        correctIndex: 1,
        explanation: 'PASS: Pull the pin, Aim at the base of fire, Squeeze the lever, Sweep from side to side.'
      },
      {
        id: 'q2',
        question: 'In the event of an emergency evacuation alarm, what is the staff responsibility regarding elevators?',
        options: [
          'Use elevators for fast evacuation of all luggage',
          'Direct all guests to stairwells and never use elevators during a fire evacuation',
          'Hold elevator doors open on guest floors',
          'Inspect elevator shafts'
        ],
        correctIndex: 1,
        explanation: 'Elevators can become smoke shafts or lose power; stairwells must be used exclusively during emergency evacuation.'
      },
      {
        id: 'q3',
        question: 'What is the immediate first-aid step if a colleague receives a deep heat burn from kitchen equipment?',
        options: [
          'Apply ice directly or grease/butter',
          'Cool under clean running water for at least 10–20 minutes and cover loosely with a sterile dressing',
          'Pop any blisters immediately',
          'Rub salt on the area'
        ],
        correctIndex: 1,
        explanation: 'Cool running water reduces skin temperature and tissue damage. Ice or ointments trap heat and cause further injury.'
      },
      {
        id: 'q4',
        question: 'When encountering an unattended bag or suspicious package in the hotel lobby, what is the correct protocol?',
        options: [
          'Open the bag to find owner information',
          'Move the bag into the back office',
          'Do not touch or move it; secure the perimeter and immediately notify Hotel Security and the Duty Manager',
          'Place it in the lost and found bin'
        ],
        correctIndex: 2,
        explanation: 'Suspicious items must not be touched or moved. Immediate security notification and perimeter control is required.'
      }
    ]
  }

  // 7. General Hospitality, Customer Service & Communication (Default)
  return [
    {
      id: 'q1',
      question: `What is the primary standard of excellence when applying the skills covered in "${course.title}"?`,
      options: [
        'Meeting minimum standards only when inspected',
        'Consistently applying company SOPs to ensure high guest satisfaction, accuracy, and safety',
        'Prioritizing speed over quality and safety',
        'Delegating all responsibilities to colleagues'
      ],
      correctIndex: 1,
      explanation: 'Excellence in hospitality requires disciplined consistency in delivering brand standards and safety protocols.'
    },
    {
      id: 'q2',
      question: 'Which communication practice demonstrates highest professionalism when interacting with guests and team members?',
      options: [
        'Using technical jargon that others may not understand',
        'Active listening, clear acknowledgment, polite tone, and confirming mutual understanding',
        'Interrupting to finish sentences faster',
        'Avoiding eye contact during difficult inquiries'
      ],
      correctIndex: 1,
      explanation: 'Active listening and respectful clarity ensure flawless team execution and premium guest experiences.'
    },
    {
      id: 'q3',
      question: 'When faced with an unexpected operational challenge during a shift, what is the best course of action?',
      options: [
        'Conceal the error to avoid reprimand',
        'Assess the situation against safety standards, notify supervisor promptly, and execute appropriate SOP contingency',
        'Abandon the workstation until someone else fixes it',
        'Blame external factors'
      ],
      correctIndex: 1,
      explanation: 'Transparent problem reporting and following established contingency procedures protects operational integrity.'
    },
    {
      id: 'q4',
      question: 'How do the competencies gained from this course directly impact team performance and guest trust?',
      options: [
        'They have minimal impact outside of testing',
        'They standardize quality, reduce rework/errors, and enhance the overall guest journey and brand reputation',
        'They only benefit individual resume credentials',
        'They replace the need for supervisor guidance'
      ],
      correctIndex: 1,
      explanation: 'Competency mastery directly drives higher guest satisfaction scores, team coordination, and operational excellence.'
    }
  ]
}

async function run() {
  console.log('Seeding course quizzes for all learning resources...')
  const { rows: courses } = await query('SELECT id, title, category, description, objectives FROM learning_resources')
  let updatedCount = 0

  for (const c of courses) {
    const quiz = generateQuizForCourse(c)
    await query(
      `UPDATE learning_resources
       SET quiz = $1::jsonb,
           pass_threshold = 75
       WHERE id = $2`,
      [JSON.stringify(quiz), c.id]
    )
    updatedCount++
  }

  console.log(`Successfully configured assessments and quizzes for ${updatedCount} courses!`)
  await pool.end()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
