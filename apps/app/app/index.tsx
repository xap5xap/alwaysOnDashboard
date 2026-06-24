// The index route: the auth gate. While the session loads, show a splash; signed-out shows the
// minimal sign-in; signed-in shows the dashboard. (Route files stay thin and delegate to src/
// screens so the Unistyles babel plugin's `root: 'src'` covers all styled components.)
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { SignIn } from '../src/screens/SignIn';
import { Dashboard } from '../src/dashboard/Dashboard';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B0F' }}>
        <ActivityIndicator color="#6E8BFF" />
      </View>
    );
  }

  return session ? <Dashboard /> : <SignIn />;
}
