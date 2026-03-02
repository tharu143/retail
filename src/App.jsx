import { HashRouter, Route, Routes } from "react-router-dom"
import UserRouter from "./Routes/UserRouter"


function App() {

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/*" element={<UserRouter />} />
        </Routes>
      </HashRouter>
    </>
  )
}

export default App
