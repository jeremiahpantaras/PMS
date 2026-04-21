import { Navigate, useParams } from 'react-router-dom';

export const PatientProfile = () => {
  const { patientId, id } = useParams<{ patientId?: string; id?: string }>();
  const resolvedId = patientId || id;

  if (!resolvedId) {
    return <Navigate to="/clients" replace />;
  }

  return <Navigate to={`/patients/${resolvedId}/profile`} replace />;
};
