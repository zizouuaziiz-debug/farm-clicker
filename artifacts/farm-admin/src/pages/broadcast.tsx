import { useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/admin-auth";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface Broadcast {
  id: number;
  message: string;
  status: string;
  totalUsers: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

export default function Broadcast() {

  const [message, setMessage] = useState("");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);


  async function loadBroadcasts() {
    try {
      const data = await fetchAdmin("/api/admin/broadcasts");
      setBroadcasts(data);
    } catch {
      toast.error("Failed to load broadcasts");
    }
  }


  useEffect(() => {
    loadBroadcasts();
  }, []);



  async function createBroadcast() {

    if (!message.trim()) {
      toast.error("Message is empty");
      return;
    }


    setLoading(true);

    try {

      await fetchAdmin("/api/admin/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          message,
          parseMode: "HTML",
          target: "all",
        }),
      });


      toast.success("Broadcast created");

      setMessage("");

      loadBroadcasts();


    } catch (err) {

      toast.error(
        err instanceof Error ? err.message : "Failed"
      );

    } finally {

      setLoading(false);

    }

  }



  return (
    <div className="p-6">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-2xl font-bold text-gray-900">
          📢 Broadcast
        </h1>

      </div>



      <div className="bg-white rounded-2xl border p-5 mb-6">

        <textarea
          value={message}
          onChange={(e)=>setMessage(e.target.value)}
          placeholder="Write message for users..."
          className="w-full h-32 border rounded-xl p-3 text-sm"
        />


        <button
          onClick={createBroadcast}
          disabled={loading}
          className="mt-4 px-5 py-2.5 bg-green-600 text-white rounded-xl"
        >

          {loading ? "Creating..." : "Create Broadcast"}

        </button>

      </div>




      <div className="bg-white rounded-2xl border overflow-hidden">

        <div className="p-4 border-b font-semibold">
          History
        </div>


        <table className="w-full text-sm">

          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Message</th>
              <th>Status</th>
              <th>Total</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Date</th>
            </tr>
          </thead>


          <tbody>

          {broadcasts.map((b)=>(

            <tr key={b.id} className="border-t">

              <td className="p-3 max-w-xs truncate">
                {b.message}
              </td>

              <td>
                {b.status}
              </td>

              <td>
                {b.totalUsers}
              </td>

              <td className="text-green-600">
                {b.successCount}
              </td>

              <td className="text-red-600">
                {b.failedCount}
              </td>

              <td>
                {formatDate(b.createdAt)}
              </td>

            </tr>

          ))}

          </tbody>

        </table>


      </div>


    </div>
  );
}
