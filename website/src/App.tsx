import { createHashRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Install from './pages/Install';
import Usage from './pages/Usage';
import Changelog from './pages/Changelog';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: '/install',
        element: <Install />,
      },
      {
        path: '/usage',
        element: <Usage />,
      },
      {
        path: '/changelog',
        element: <Changelog />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
