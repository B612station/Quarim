'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        sb.from('profiles').select('role').eq('id', data.session.user.id).single().then(({ data: p }) => {
          router.replace(p?.role === 'admin' ? '/admin' : '/employee')
        })
      } else {
        router.replace('/login')
      }
    })
  }, [router])
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontStyle:'italic', fontFamily:'Georgia,serif', fontSize:'22px', opacity:.4 }}>Quarim</div>
}
