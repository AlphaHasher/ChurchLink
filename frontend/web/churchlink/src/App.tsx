import { BrowserRouter as Router, Routes, Route, useParams, Navigate, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { AppRouter } from "./router/AppRouter";
import { PersistGate } from 'redux-persist/integration/react' 
import { Provider } from 'react-redux'

function GeneralWrapper() {
  const { name } = useParams();
  return <General name={name || "Home"} />;
}



function App() {
  const { user, role } = useAuth(); // Get auth state

  return (
    <AuthProvider>
      <BrowserRouter>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <AppRouter />
                </PersistGate>
            </Provider>
        </BrowserRouter>
     
    </AuthProvider>
  );
}

export default App;