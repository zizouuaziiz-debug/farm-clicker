import { useState } from "react";
import { toast } from "sonner";

export default function Broadcast() {

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);


  async function createBroadcast(){

    if(!message.trim()){
      toast.error("Message required");
      return;
    }

    setLoading(true);

    try{

      const token = localStorage.getItem("admin_token");

      const res = await fetch("/api/admin/broadcasts",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${token}`
        },
        body:JSON.stringify({
          message,
          parseMode:"HTML",
          target:"all"
        })
      });


      if(!res.ok){
        throw new Error("Failed");
      }


      toast.success("Broadcast created");

      setMessage("");

      loadBroadcasts();


    }catch(e){

      toast.error("Error creating broadcast");

    }finally{

      setLoading(false);

    }

  }



  async function loadBroadcasts(){

    try{

      const token = localStorage.getItem("admin_token");

      const res = await fetch("/api/admin/broadcasts",{
        headers:{
          "Authorization":`Bearer ${token}`
        }
      });


      const data = await res.json();

      setBroadcasts(data);

    }catch(e){}

  }


  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        📢 Broadcast Messages
      </h1>


      <div className="bg-white rounded-xl p-5 shadow mb-6">

        <textarea
          className="w-full border rounded-lg p-3 h-32"
          placeholder="Write message..."
          value={message}
          onChange={(e)=>setMessage(e.target.value)}
        />


        <button
          onClick={createBroadcast}
          disabled={loading}
          className="mt-4 bg-green-600 text-white px-5 py-2 rounded-lg"
        >
          {loading ? "Creating..." : "Send Broadcast"}
        </button>

      </div>



      <div className="bg-white rounded-xl p-5">

        <h2 className="font-bold mb-4">
          History
        </h2>


        {broadcasts.map((b)=>(
          <div
            key={b.id}
            className="border-b py-3"
          >

            <div>
              {b.message}
            </div>

            <div className="text-sm text-gray-500">
              {b.status} |
              Success: {b.successCount}
              {" "}
              Failed: {b.failedCount}
            </div>

          </div>
        ))}


      </div>


    </div>
  );
}
