import MainLayout from "../layouts/MainLayout";
import ArticlesListPage from "@/pages/ArticlesListPage";
import ArticlePage from "@/pages/ArticlePage";
import General from "@/pages/General";
import { Route, Routes, useParams } from "react-router-dom";
import {
  Calendar,
  FileVideo,
  Heart,
  Home,
  Inbox,
  Languages,
  LogIn,
  Newspaper,
  Search,
  User,
} from "lucide-react";
import { Item } from "@/components/Main/AppSidebar";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";



function GeneralWrapper() {
  const { name } = useParams();
  return <General name={name || "Home"} />;
}

export const PublicRoutes = () => {

  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/:name?" element={<GeneralWrapper />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
        </Routes>
      </MainLayout>
    </>
  );
};
