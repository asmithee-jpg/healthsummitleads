export interface Attendee {
  id: string
  name: string
  title: string
  org: string
  email: string
  phone?: string
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
