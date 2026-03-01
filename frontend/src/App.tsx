import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import GraphView from './pages/GraphView'
import GraphsView from './pages/GraphsView'
import DocumentsView from './pages/DocumentsView'
import SearchView from './pages/SearchView'
import HistoryView from './pages/HistoryView'
import PipelineView from './pages/PipelineView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<GraphView />} />
          <Route path="graphs" element={<GraphsView />} />
          <Route path="documents" element={<DocumentsView />} />
          <Route path="search" element={<SearchView />} />
          <Route path="history" element={<HistoryView />} />
          <Route path="pipeline" element={<PipelineView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
