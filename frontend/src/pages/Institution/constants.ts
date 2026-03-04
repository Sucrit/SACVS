export const PHINMA_DEPARTMENT_COURSE_MAP: Record<string, string[]> = {
  'College of Engineering and Architecture (CEA)': [
    'Bachelor of Science in Civil Engineering',
    'Bachelor of Science in Architecture',
    'Bachelor of Science in Electronics Communication Engineering',
    'Bachelor of Science in Computer Engineering',
    'Bachelor of Science in Electrical Engineering',
    'Certificate in Building Technology',
  ],
  'College of Information Technology Education (CITE)': [
    'Bachelor of Science in Information Technology',
    'Associate in Computer Technology',
  ],
  'College of Allied Health Sciences (CAHS)': [
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Medical Laboratory Science',
    'Bachelor of Science in Physical Therapy',
    'Diploma in Midwifery',
    'Diploma in Caregiving',
  ],
  'College of Management and Accountancy (CMA)': [
    'Bachelor of Science in Business Administration (Financial Management)',
    'Bachelor of Science in Business Administration (Marketing Management)',
    'Bachelor of Science in Accountancy',
    'Bachelor of Science in Accounting Technology',
    'Bachelor of Science in Hotel and Restaurant Management',
    'Bachelor of Science in Tourism Management',
  ],
  'College of Education and Liberal Arts (CELA)': [
    'Bachelor of Elementary Education',
    'Bachelor of Secondary Education (English)',
    'Bachelor of Secondary Education (Mathematics)',
    'Bachelor of Secondary Education (Biology)',
    'Bachelor of Secondary Education (Filipino)',
    'Bachelor of Arts in Mass Communication',
    'Bachelor of Arts in Political Science',
  ],
  'College of Social Sciences (CSS)': [
    'Bachelor of Arts in Political Science',
    'Bachelor of Arts in Mass Communication',
  ],
  'College of Criminal Justice Education (CCJE)': [
    'Bachelor of Science in Criminology',
  ],
};

export const OTHER_PHINMA_PROGRAMS = [
  'Bachelor of Laws',
];

export const DEFAULT_DEPARTMENT_OPTIONS = Object.keys(PHINMA_DEPARTMENT_COURSE_MAP);
