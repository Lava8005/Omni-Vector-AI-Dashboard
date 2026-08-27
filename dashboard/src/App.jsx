import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Scatter } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, Tooltip)

function App() {
  const [candidates, setCandidates] = useState([])
  const [sortKey, setSortKey] = useState('composite_score')
  const [sortDir, setSortDir] = useState(-1)
  const [selectedCode, setSelectedCode] = useState(null)

  useEffect(() => {
    async function fetchCandidates() {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
      
      if (error) {
        console.error('Error fetching candidates:', error)
      } else if (data) {
        // Add dynamic norm_vina for visual bars (percentile rank)
        const sortedVina = [...data].sort((a, b) => a.vina_score - b.vina_score)
        data.forEach(c => {
          const rank = sortedVina.findIndex(x => x.vina_score === c.vina_score) + 1
          c.norm_vina = (data.length - rank) / Math.max(1, data.length - 1)
        })
        
        setCandidates(data)
        if (data.length > 0) {
          const top = [...data].sort((a, b) => b.composite_score - a.composite_score)[0]
          setSelectedCode(top.candidate_code)
        }
      }
    }
    fetchCandidates()
  }, [])

  const sortedData = [...candidates].sort((a, b) => {
    let valA = a[sortKey]
    let valB = b[sortKey]
    // if sort key is binding, we sort by vina_score but inverted since more negative is better
    if (sortKey === 'vina_score') {
      return (valA - valB) * (sortDir * -1) // flip logic for vina since smaller is better
    }
    return (valA - valB) * sortDir
  })

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(sortDir * -1)
    } else {
      setSortKey(key)
      setSortDir(-1) // Default descending for new key
    }
  }

  const getRank = (code) => {
    const sortedByComposite = [...candidates].sort((a, b) => b.composite_score - a.composite_score)
    return sortedByComposite.findIndex(c => c.candidate_code === code) + 1
  }

  const getLabel = (kind, v) => {
    if (kind === 'binding') return v >= 0.85 ? 'Very strong binder' : v >= 0.7 ? 'Solid binder' : v >= 0.5 ? 'Moderate binder' : 'Weak binder'
    if (kind === 'bbb') return v >= 0.8 ? 'Very likely crosses the BBB' : v >= 0.6 ? 'Likely crosses the BBB' : v >= 0.4 ? 'Uncertain BBB crossing' : 'Unlikely to cross the BBB'
    if (kind === 'qed') return v >= 0.7 ? 'Strong drug-like profile' : v >= 0.5 ? 'Reasonable drug-like profile' : 'Weak drug-like profile'
  }

  const selectedCandidate = candidates.find(c => c.candidate_code === selectedCode)

  const barChartData = selectedCandidate ? {
    labels: ['Binding', 'BBB crossing', 'Drug-likeness'],
    datasets: [{
      data: [selectedCandidate.norm_vina, selectedCandidate.bbb_probability, selectedCandidate.qed],
      backgroundColor: ['#2451D6', '#0E9F6E', '#E2793D'],
      borderRadius: 5,
      barThickness: 20,
    }]
  } : null

  const barChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { min: 0, max: 1, grid: { color: '#EEF0EC' }, ticks: { color: '#8A9098', font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: '#14171A', font: { size: 12, weight: '600' } } }
    }
  }

  const scatterData = {
    datasets: [{
      data: candidates.map(c => ({
        x: c.norm_vina,
        y: c.bbb_probability,
        r: 5 + c.qed * 13,
        code: c.candidate_code,
        pareto: c.on_pareto_front
      })),
      backgroundColor: candidates.map(c => c.on_pareto_front ? 'rgba(226,121,61,0.85)' : 'rgba(36,81,214,0.45)'),
      borderColor: candidates.map(c => c.on_pareto_front ? '#B85A22' : 'rgba(36,81,214,0.6)'),
      borderWidth: 1.5,
    }]
  }

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    elements: { point: { radius: (ctx) => ctx.raw?.r || 5 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => `${item.raw.code} — binding ${item.raw.x.toFixed(2)}, BBB ${item.raw.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: { min: 0, max: 1, title: { display: true, text: 'Binding score (normalized)', color: '#5C6570', font: { size: 11 } }, grid: { color: '#EEF0EC' }, ticks: { color: '#8A9098' } },
      y: { min: 0, max: 1, title: { display: true, text: 'BBB crossing probability', color: '#5C6570', font: { size: 11 } }, grid: { color: '#EEF0EC' }, ticks: { color: '#8A9098' } }
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" fill="var(--surface)" stroke="var(--border)"/>
            <circle cx="14" cy="15" r="3.4" fill="var(--blue)"/>
            <circle cx="27" cy="14" r="2.6" fill="var(--green)"/>
            <circle cx="21" cy="27" r="2.9" fill="var(--amber)"/>
            <line x1="14" y1="15" x2="27" y2="14" stroke="#C9CDC5" strokeWidth="1.4"/>
            <line x1="14" y1="15" x2="21" y2="27" stroke="#C9CDC5" strokeWidth="1.4"/>
            <line x1="27" y1="14" x2="21" y2="27" stroke="#C9CDC5" strokeWidth="1.4"/>
          </svg>
          <div className="brand-text">
            <h1>OmniVector-AI</h1>
            <p>Candidate ranking — Acetylcholinesterase (AChE) · target PDB 1E66</p>
          </div>
        </div>
        <span className="status-pill"><span className="dot"></span>Live Database Connection</span>
      </div>

      <div className="explainer">
        <div className="explain-card">
          <div className="explain-icon ic-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l3 5.5L21 10l-4.5 4L18 21l-6-3.5L6 21l1.5-7L3 10l6-1.5L12 3z" stroke="var(--blue)" strokeWidth="1.6" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h3>Does it bind the target?</h3>
            <p>Docking + Boltz-2 structure &amp; affinity prediction against AChE.</p>
          </div>
        </div>
        <div className="explain-card">
          <div className="explain-icon ic-green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12c2-5 6-8 8-8s6 3 8 8-6 8-8 8-6-3-8-8z" stroke="var(--green)" strokeWidth="1.6"/><circle cx="12" cy="12" r="2.4" stroke="var(--green)" strokeWidth="1.6"/></svg>
          </div>
          <div>
            <h3>Can it reach the brain?</h3>
            <p>Graph neural network trained on B3DB predicts blood–brain barrier crossing.</p>
          </div>
        </div>
        <div className="explain-card">
          <div className="explain-icon ic-amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="var(--amber)" strokeWidth="1.6"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="var(--amber)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h3>Is it a realistic candidate?</h3>
            <p>RDKit drug-likeness (QED) and Lipinski rule checks filter out impractical molecules.</p>
          </div>
        </div>
      </div>

      <div className="main-grid">
        <div className="panel">
          <div className="section-head">Ranked shortlist</div>
          <p className="section-sub">Sorted by composite score. Click any row for a full breakdown.</p>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('composite_score')}>Rank {sortKey === 'composite_score' && <span className="arrow">▾</span>}</th>
                <th onClick={() => handleSort('candidate_code')}>Candidate {sortKey === 'candidate_code' && <span className="arrow">▾</span>}</th>
                <th onClick={() => handleSort('vina_score')}>Binding {sortKey === 'vina_score' && <span className="arrow">▾</span>}</th>
                <th onClick={() => handleSort('bbb_probability')}>BBB crossing {sortKey === 'bbb_probability' && <span className="arrow">▾</span>}</th>
                <th onClick={() => handleSort('qed')}>Drug-likeness {sortKey === 'qed' && <span className="arrow">▾</span>}</th>
                <th onClick={() => handleSort('composite_score')}>Composite</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(c => {
                const isTop = getRank(c.candidate_code) === 1
                return (
                  <tr key={c.id} className={c.candidate_code === selectedCode ? 'active' : ''} onClick={() => setSelectedCode(c.candidate_code)}>
                    <td><div className="rank-cell"><span className="rank-num">{getRank(c.candidate_code)}</span>{isTop && <span className="top-badge">TOP</span>}</div></td>
                    <td className="code-cell">{c.candidate_code}</td>
                    <td className="bar-cell">
                      <div className="bar-track"><div className="bar-fill blue" style={{ width: `${c.norm_vina * 100}%` }}></div></div>
                      <span className="bar-val">{c.vina_score?.toFixed(2)}</span>
                    </td>
                    <td className="bar-cell">
                      <div className="bar-track"><div className="bar-fill green" style={{ width: `${c.bbb_probability * 100}%` }}></div></div>
                      <span className="bar-val">{c.bbb_probability?.toFixed(2)}</span>
                    </td>
                    <td className="bar-cell">
                      <div className="bar-track"><div className="bar-fill amber" style={{ width: `${c.qed * 100}%` }}></div></div>
                      <span className="bar-val">{c.qed?.toFixed(2)}</span>
                    </td>
                    <td className="composite-cell">{c.composite_score?.toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="panel detail">
          {selectedCandidate && (
            <>
              <div className="detail-title">{selectedCandidate.candidate_code}</div>
              <p className="detail-sub">Composite score {selectedCandidate.composite_score?.toFixed(4)} {selectedCandidate.on_pareto_front ? '· on the Pareto front' : ''}</p>
              <div className="verdict">
                <b>{getLabel('binding', selectedCandidate.norm_vina)}.</b> {getLabel('bbb', selectedCandidate.bbb_probability)}. {getLabel('qed', selectedCandidate.qed)}.
              </div>
              <div className="chart-wrap">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
              <div className="viewer-box">
                <svg viewBox="0 0 60 60" fill="none">
                  <circle cx="18" cy="16" r="4" fill="var(--blue)"/>
                  <circle cx="42" cy="14" r="3" fill="var(--green)"/>
                  <circle cx="30" cy="34" r="3.4" fill="var(--amber)"/>
                  <circle cx="14" cy="40" r="2.6" fill="var(--blue)" opacity=".55"/>
                  <circle cx="46" cy="42" r="2.6" fill="var(--green)" opacity=".55"/>
                  <line x1="18" y1="16" x2="42" y2="14" stroke="#CDD1C8" strokeWidth="1.3"/>
                  <line x1="18" y1="16" x2="30" y2="34" stroke="#CDD1C8" strokeWidth="1.3"/>
                  <line x1="42" y1="14" x2="30" y2="34" stroke="#CDD1C8" strokeWidth="1.3"/>
                  <line x1="18" y1="16" x2="14" y2="40" stroke="#CDD1C8" strokeWidth="1.3"/>
                  <line x1="42" y1="14" x2="46" y2="42" stroke="#CDD1C8" strokeWidth="1.3"/>
                </svg>
                <p>Interactive 3D structure viewer goes here — wires to the Boltz-2 predicted complex file once Tier-2 is live.</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pareto-panel">
        <div className="section-head">Trade-off view — Pareto front</div>
        <p className="section-sub">No candidate on the front can be improved on one score without giving up another.</p>
        <div className="pareto-grid">
          <div className="pareto-chart">
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
          <div className="pareto-caption">
            <p><b>What this shows.</b> Every candidate plotted by binding score (x) and BBB-crossing probability (y). Dot size reflects drug-likeness.</p>
            <p><b>Amber-ringed points</b> are on the Pareto front — the set of candidates where no other one beats them on every score at once. These are the ones worth a closer look first.</p>
            <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--blue)', opacity: .55 }}></span> Off the front</div>
            <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--amber)' }}></span> On the Pareto front</div>
          </div>
        </div>
      </div>

      <div className="footer">
        <div className="metric-chip">
          <div className="label">Docking baseline (literature)</div>
          <div className="value">≈ 0.70 AUC</div>
          <div className="note">Plain Vina/Smina on DUD-E — what Boltz-2 refinement aims to beat.</div>
        </div>
        <div className="metric-chip">
          <div className="label">BBB model target</div>
          <div className="value">≥ 0.85 AUC</div>
          <div className="note">Held-out B3DB test set, reported on random &amp; scaffold splits.</div>
        </div>
        <div className="metric-chip">
          <div className="label">Enrichment factor</div>
          <div className="value">Pending</div>
          <div className="note">Reported after the blinded DUD-E validation run.</div>
        </div>
      </div>
    </>
  )
}

export default App
