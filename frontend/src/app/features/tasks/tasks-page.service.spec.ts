import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { TasksApi } from './tasks.api';
import { TasksPageComponentService } from './tasks-page.service';

// Runs with TZ=Europe/Berlin (see `npm test`): 09:15 local on 1 March = 08:15 UTC.
describe('TasksPageComponentService.save', () => {
  function setup() {
    const api = { create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) };
    TestBed.configureTestingModule({
      providers: [
        TasksPageComponentService,
        { provide: TasksApi, useValue: api },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    return { service: TestBed.inject(TasksPageComponentService), api };
  }
  const form = { title: 'Call', description: 'Notes', priority: 'high', dueAt: '2026-03-01T09:15' };

  it('sends the due date entered in local time as UTC', async () => {
    const { service, api } = setup();
    await service.save(null, form);
    expect(api.create).toHaveBeenCalledWith({
      title: 'Call',
      description: 'Notes',
      priority: 'high',
      dueAt: '2026-03-01T08:15:00.000Z',
    });
  });

  it('clears the description and due date on edit when the fields are emptied', async () => {
    const { service, api } = setup();
    await service.save('task-1', { ...form, description: '', dueAt: '' }, '2026-03-01T08:15:00.000Z');
    expect(api.update).toHaveBeenCalledWith('task-1', {
      title: 'Call',
      description: null,
      priority: 'high',
      dueAt: null,
    });
  });

  it('does not re-send an untouched due date (keeps seconds, avoids DST shifts)', async () => {
    const { service, api } = setup();
    await service.save('task-1', { ...form, title: 'Renamed' }, '2026-03-01T08:15:30.123Z');
    expect(api.update).toHaveBeenCalledWith('task-1', { title: 'Renamed', description: 'Notes', priority: 'high' });
  });

  it('sends a changed due date', async () => {
    const { service, api } = setup();
    await service.save('task-1', { ...form, dueAt: '2026-03-02T10:00' }, '2026-03-01T08:15:00.000Z');
    expect(api.update).toHaveBeenCalledWith('task-1', expect.objectContaining({ dueAt: '2026-03-02T09:00:00.000Z' }));
  });
});
