import React from 'react'
import HeroPieChart from '../components/HeroPieChart'
import InsightsPanel from '../components/InsightsPanel'
import './Dashboard.css'

export default function Dashboard({ user }) {
  return (
    <div className="dashboard">
      <HeroPieChart user={user} />
      <InsightsPanel />
    </div>
  )
}
