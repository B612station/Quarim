export type Role = 'admin' | 'employee'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  pole: string | null
  org_name: string
  created_at: string
}

export interface Brief {
  id: string
  author_id: string
  week_date: string
  transcript: string | null
  summary: BriefSummary | null
  created_at: string
}

export interface BriefSummary {
  situation_actuelle: string
  problemes_semaine: string
  actions_prochaine_semaine: string
  points_bloquants: string
  infos_pratiques: string
}

export interface Avancee {
  id: string
  author_id: string
  transcript: string | null
  resume: string | null
  confidentiel: boolean
  week_date: string
  created_at: string
  profiles?: Profile
}

export interface Channel {
  id: string
  name: string
  description: string | null
  pole: string | null
  created_by: string
  created_at: string
}

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  confidentiel: boolean
  created_at: string
  profiles?: Profile
}

export interface Escalade {
  id: string
  author_id: string
  question: string
  context_quarim: string | null
  reponse: string | null
  reponse_by: string | null
  reponse_at: string | null
  created_at: string
  profiles?: Profile
}

export const POLES = ['RH', 'Marketing', 'Commercial', 'Juridique', 'Opérations', 'Finance', 'Technique', 'Direction']

export const BRIEF_SECTIONS = [
  { key: 'situation_actuelle', label: 'Situation actuelle', roman: 'I' },
  { key: 'problemes_semaine', label: 'Problèmes rencontrés', roman: 'II' },
  { key: 'actions_prochaine_semaine', label: 'Actions semaine prochaine', roman: 'III' },
  { key: 'points_bloquants', label: 'Points bloquants', roman: 'IV' },
  { key: 'infos_pratiques', label: 'Infos pratiques', roman: 'V' },
] as const
