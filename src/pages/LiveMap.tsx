import { useParams, useNavigate } from "react-router-dom";
import { CustomerDeliveryTracker } from "@/components/customer/CustomerDeliveryTracker";

export default function LiveMap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  return (
    <CustomerDeliveryTracker
      scheduleId={id}
      onBack={() => navigate(-1)}
    />
  );
}
