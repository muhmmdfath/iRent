import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import { guideGroups, guideTopics } from './guide-content';
import './guide-page.css';

export function GuidePage() {
  const [params, setParams] = useSearchParams();
  const index = Math.max(
    0,
    guideTopics.findIndex((topic) => topic.id === params.get('topik')),
  );
  const topic = guideTopics[index];
  const previous = guideTopics[index - 1];
  const next = guideTopics[index + 1];
  const topicUrl = (id: string) => {
    const search = new URLSearchParams(params);
    search.set('topik', id);
    return { pathname: '/admin/guide', search: '?' + search.toString() };
  };
  return (
    <div className="admin-guide">
      <header className="guide-heading">
        <p>Operasional iRent</p>
        <h1>Panduan admin</h1>
        <div>
          Langkah kerja dan hal yang perlu diperiksa saat melayani sewa.
        </div>
      </header>
      <div className="guide-mobile-topics">
        <label htmlFor="guide-topic">Pilih topik panduan</label>
        <div>
          <select
            id="guide-topic"
            value={topic.id}
            onChange={(event) =>
              setParams(
                (previous) => {
                  const updated = new URLSearchParams(previous);
                  updated.set('topik', event.target.value);
                  return updated;
                },
                { preventScrollReset: true },
              )
            }
          >
            {guideGroups.map((group) => (
              <optgroup label={group.label} key={group.id}>
                {guideTopics
                  .filter((item) => item.group === group.id)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <ChevronRightIcon aria-hidden="true" />
        </div>
      </div>
      <div className="guide-body">
        <nav className="guide-sidebar" aria-label="Topik panduan">
          {guideGroups.map((group) => (
            <div className="guide-topic-group" key={group.id}>
              <h2>{group.label}</h2>
              {guideTopics
                .filter((item) => item.group === group.id)
                .map((item) => (
                  <Link
                    className="guide-link"
                    key={item.id}
                    to={topicUrl(item.id)}
                    preventScrollReset
                    aria-current={item.id === topic.id ? 'page' : undefined}
                  >
                    <span>{item.title}</span>
                    {item.id === topic.id && (
                      <ChevronRightIcon aria-hidden="true" />
                    )}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <article
          className="guide-article"
          aria-labelledby="guide-article-title"
        >
          <header className="guide-article-heading">
            <p>
              {guideGroups.find((group) => group.id === topic.group)?.label}
            </p>
            <h2 id="guide-article-title">{topic.title}</h2>
            <div>{topic.summary}</div>
          </header>
          <ol className="guide-steps">
            {topic.steps.map((step, stepIndex) => (
              <li key={step.title}>
                <span className="guide-step-number" aria-hidden="true">
                  {stepIndex + 1}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="guide-note" aria-label="Catatan penting">
            <InfoCircledIcon aria-hidden="true" />
            <div>
              <h3>{topic.note.title}</h3>
              <p>{topic.note.text}</p>
            </div>
          </aside>
          <div className="guide-actions">
            <Link to={topic.path} className="guide-link guide-primary-action">
              {topic.action}
              <ChevronRightIcon aria-hidden="true" />
            </Link>
            {topic.related && (
              <Link
                to={topic.related.path}
                className="guide-link guide-related-action"
              >
                {topic.related.label}
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            )}
          </div>
          <nav className="guide-pagination" aria-label="Urutan panduan">
            {previous ? (
              <Link
                className="guide-link"
                to={topicUrl(previous.id)}
                preventScrollReset
              >
                <ChevronLeftIcon aria-hidden="true" />
                <span>
                  <small>Sebelumnya</small>
                  {previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                className="guide-link"
                to={topicUrl(next.id)}
                preventScrollReset
              >
                <span>
                  <small>Selanjutnya</small>
                  {next.title}
                </span>
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}
