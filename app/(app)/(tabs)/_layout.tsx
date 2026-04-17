import {Ionicons} from '@expo/vector-icons';
import {Icon, Label, NativeTabs, VectorIcon} from 'expo-router/unstable-native-tabs';
import React from 'react';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <Label>Home</Label>
        <Icon
          sf={{default: 'house', selected: 'house.fill'}}
          androidSrc={<VectorIcon family={Ionicons} name="home" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Label>Calendar</Label>
        <Icon
          sf={{default: 'calendar', selected: 'calendar'}}
          androidSrc={<VectorIcon family={Ionicons} name="calendar" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="documents">
        <Label>Docs</Label>
        <Icon
          sf={{default: 'doc.text', selected: 'doc.text.fill'}}
          androidSrc={<VectorIcon family={Ionicons} name="document-text" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs">
        <Label>Jobs</Label>
        <Icon
          sf={{default: 'briefcase', selected: 'briefcase.fill'}}
          androidSrc={<VectorIcon family={Ionicons} name="briefcase" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
