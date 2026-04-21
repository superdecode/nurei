import { redirect } from 'next/navigation'

export default function AffiliatesLoginPage() {
  redirect('/login?redirect=/affiliate/overview')
}
