import { BrowserRouter, Routes, Route } from 'react-router'
import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage'
import { LegacyReceiptSplitterPage } from '@pages/LegacyReceiptSplitterPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReceiptSplitterPage />} />
        <Route path="/legacy" element={<LegacyReceiptSplitterPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
