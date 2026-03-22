import {Ionicons} from '@expo/vector-icons';
import {Icon, NativeTabs, Label, VectorIcon} from 'expo-router/unstable-native-tabs';
import React from 'react';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <Label>Home</Label>
        <Icon src={<VectorIcon family={Ionicons} name="home" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Label>Calendar</Label>
        <Icon src={<VectorIcon family={Ionicons} name="calendar" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="documents">
        <Label>Docs</Label>
        <Icon src={<VectorIcon family={Ionicons} name="document-text" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs">
        <Label>Jobs</Label>
        <Icon src={<VectorIcon family={Ionicons} name="briefcase" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
