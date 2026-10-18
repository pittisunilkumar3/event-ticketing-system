import { useEffect, useState } from "react";


import MyAccount from "./MyAccount";
import api from "../api/client";
import { Alert } from "../components/ui";

export default function Settings() {
  const [admin, setAdmin] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setAdmin(data.data.admin))
      .catch(() => setFailed(true));
  }, []);
  if (failed)
    return (
      <Alert>Unable to load settings. Refresh the page to try again.</Alert>
    );
  if (!admin)
    return (
      <p className="py-8 text-slate-500" role="status">
        Loading settings…
      </p>
    );
  return <div><div className="studio-heading"><h1>My account</h1></div><MyAccount admin={admin} onUpdate={setAdmin}/></div>;
}
