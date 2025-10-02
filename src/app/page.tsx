import AllSongs from "@/components/AllSongs";
import FrontendLayout from "../../layouts/FrontendLayout";



export default function Home() {
  return (
   <FrontendLayout>
     <div className="min-h-screen">
      <AllSongs/>
    </div>
   </FrontendLayout>
  );
}
