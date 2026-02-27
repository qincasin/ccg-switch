import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ToastContainer from '../common/ToastContainer';

function Layout() {
    return (
        <div className="h-screen flex bg-[#FAFBFC] dark:bg-base-300">
            {/* 全局窗口拖拽区域 */}
            <div
                className="fixed top-0 left-0 right-0 h-8"
                style={{
                    zIndex: 9999,
                    backgroundColor: 'rgba(0,0,0,0.001)',
                    cursor: 'default',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}
                data-tauri-drag-region
            />
            <ToastContainer />
            {/* 左侧边栏 */}
            <Sidebar />
            {/* 右侧：顶栏 + 内容 */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-hidden flex flex-col relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default Layout;
