// PATH: src/student/domains/clinic-idcard/components/LiveStamp.tsx

import { useEffect, useState } from "react";

export default function LiveStamp() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="live-stamp">
      <span className="live-dot" />
      {now.toLocaleDateString()} {now.toLocaleTimeString()}
    </div>
  );
}
