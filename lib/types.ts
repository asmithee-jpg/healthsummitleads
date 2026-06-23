export interface Attendee {
  id: string
  name: string
  title: string
  org: string
  email: string
  phone?: string
  bio?: string
  avatar?: string
  connections?: string[] // attendee IDs
}

export interface Speaker {
  id: string
  name: string
  title: string
  org: string
  bio: string
  avatar?: string
  sessionIds?: string[]
}

export interface Session {
  id: string
  title: string
  description: string
  speakerIds: string[]
  startTime: string // ISO
  endTime: string   // ISO
  location: string
  day: string       // "Day 1", "Day 2" etc
  track?: string
  type: 'keynote' | 'breakout' | 'workshop' | 'networking' | 'meal'
}

export interface Sponsor {
  id: string
  name: string
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'exhibitor'
  logo?: string
  website?: string
  boothNumber?: string
  description?: string
  contactEmail?: string
}

export interface Message {
  id: string
  fromId: string
  fromName: string
  toId: string
  text: string
  sentAt: string
  read: boolean
}

export interface Connection {
  fromId: string
  toId: string
  status: 'pending' | 'connected'
  createdAt: string
}

export interface Lead {
  id: string
  attendeeId: string
  attendeeName: string
  attendeeTitle: string
  attendeeOrg: string
  attendeeEmail: string
  attendeePhone?: string
  vendorId: string
  note: string
  interest: 'hot' | 'warm' | 'cold'
  capturedAt: string
}

export interface Vendor {
  id: string
  name: string
  email: string
  passcode: string
}

export interface UserSession {
  attendeeId: string
  name: string
  email: string
  mySchedule: string[] // session IDs
}
