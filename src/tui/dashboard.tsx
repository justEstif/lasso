import { Box, render, renderToString, Text, useApp, useInput } from 'ink';
import React, { useMemo, useState } from 'react';

import type { LassoConfig } from '../config/load.ts';
import type { LassoDb } from '../db/index.ts';

import { buildLintStatusModel } from '../observers/lint/status.ts';
import { buildMemoryStatusModel } from '../observers/memory/status.ts';

interface DashboardModel {
  lint: {
    accepted: number;
    deferred: number;
    enabled: boolean;
    implemented: number;
    lastScan: string;
    proposed: number;
    recent: string[];
    rejected: number;
    throttleLimit: number;
  };
  memory: {
    enabled: boolean;
    lastReflection: string;
    lastSnapshot: string;
    recentSnapshots: string[];
    reflections: number;
    snapshots: number;
  };
  updatedAt: string;
}

interface TuiOptions {
  once?: boolean;
}

export async function handleTui(db: LassoDb, config: LassoConfig, options: TuiOptions) {
  if (options.once || !process.stdout.isTTY) {
    console.log(renderDashboard(db, config));
    return;
  }

  const instance = render(<DashboardApp config={config} db={db} />);
  await instance.waitUntilExit();
}

export function renderDashboard(db: LassoDb, config: LassoConfig) {
  return renderToString(<Dashboard model={buildDashboardModel(db, config)} />);
}

function buildDashboardModel(db: LassoDb, config: LassoConfig): DashboardModel {
  const lint = buildLintStatusModel(db, config);
  const memory = buildMemoryStatusModel(db);

  return {
    lint: {
      ...lint.counts,
      enabled: config.observers.lint.enabled,
      lastScan: lint.lastScan?.scanned_at ?? 'never',
      recent: lint.entries.slice(0, 5).map((entry) => {
        return `[${entry.id.slice(0, 8)}] ${entry.status}: ${entry.description}`;
      }),
      throttleLimit: lint.saturation.limit,
    },
    memory: {
      enabled: config.observers.memory.enabled,
      lastReflection: memory.lastReflection,
      lastSnapshot: memory.lastSnapshot,
      recentSnapshots: memory.recentSnapshots.map((snapshot) => {
        return `[${snapshot.id.slice(0, 8)}] ${snapshot.scope}: ${truncate(snapshot.content, 72)}`;
      }),
      reflections: memory.reflections,
      snapshots: memory.snapshots,
    },
    updatedAt: new Date().toLocaleString(),
  };
}

function Dashboard({ model }: { model: DashboardModel }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Panel title="lasso">
        <Text>
          Lint: {model.lint.enabled ? 'enabled' : 'disabled'} | Memory:{' '}
          {model.memory.enabled ? 'enabled' : 'disabled'}
        </Text>
        <Text>Updated: {model.updatedAt}</Text>
      </Panel>
      <Panel title="lint observer">
        <Text>Proposed: {`${model.lint.proposed} / ${model.lint.throttleLimit}`}</Text>
        <Text>Accepted: {model.lint.accepted}</Text>
        <Text>Deferred: {model.lint.deferred}</Text>
        <Text>Rejected: {model.lint.rejected}</Text>
        <Text>Implemented: {model.lint.implemented}</Text>
        <Text>Last scan: {model.lint.lastScan}</Text>
      </Panel>
      <Panel title="memory observer">
        <Text>Snapshots: {model.memory.snapshots}</Text>
        <Text>Reflections: {model.memory.reflections}</Text>
        <Text>Last snapshot: {model.memory.lastSnapshot}</Text>
        <Text>Last reflection: {model.memory.lastReflection}</Text>
      </Panel>
      <ListPanel items={model.lint.recent} title="recent lint entries" />
      <ListPanel items={model.memory.recentSnapshots} title="recent memory snapshots" />
    </Box>
  );
}

function DashboardApp({ config, db }: { config: LassoConfig; db: LassoDb }) {
  const { exit } = useApp();
  const [refreshToken, setRefreshToken] = useState(0);
  const model = useMemo(() => buildDashboardModel(db, config), [config, db, refreshToken]);

  useInput((input, key) => {
    if (input === 'q' || key.escape || (key.ctrl && input === 'c')) exit();
    if (input === 'r') setRefreshToken((value) => value + 1);
  });

  return (
    <Box flexDirection="column">
      <Dashboard model={model} />
      <Text dimColor>Press r to refresh, q to quit.</Text>
    </Box>
  );
}

function ListPanel({ items, title }: { items: string[]; title: string }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <Text dimColor>none</Text>
      ) : (
        items.map((item) => <Text key={item}>{item}</Text>)
      )}
    </Panel>
  );
}

function Panel({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={1}>
      <Text bold>{title}</Text>
      {children}
    </Box>
  );
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
