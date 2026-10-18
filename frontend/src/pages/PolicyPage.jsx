import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import api from '../api/client';
import CustomerState from '../components/CustomerState';
import Icon from '../components/Icon';
import {watchSiteContent} from '../settings/watchSiteContent';

export default function PolicyPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let controller;
    setPage(null);
    setError('');
    const load=()=>{
      controller?.abort();
      const request=new AbortController();controller=request;
      api.get(`/pages/${encodeURIComponent(slug)}`, { signal: request.signal })
        .then(({ data }) => { if (!request.signal.aborted) {setPage(data.data.page);setError('');} })
        .catch(err => { if (!request.signal.aborted) {setPage(null);setError(err.response?.status === 404 ? 'This information hasn’t been published yet. You can return to the event listings.' : 'This page couldn’t be loaded. Please try again later.');} });
    };
    load();const stop=watchSiteContent(load);
    return () => {controller?.abort();stop();};
  }, [slug]);
  if (error) return <CustomerState icon="page" eyebrow="INFORMATION" title="This page isn’t available." description={error}/>;
  if (!page) return <CustomerState loading icon="page" eyebrow="INFORMATION" title="Opening this page…"/>;
  return <PolicyDocument page={page}/>;
}

export function PolicyDocument({ page }) {
  const site=useSiteSettings();
  const updated = page.updated_at ? new Date(String(page.updated_at).replace(' ', 'T')) : null;
  return (
    <main className="customer-page policy-page">
      <div className="policy-container">
        <Link className="customer-back" to={site.is_organizer?"/events":"/"}>← {site.is_organizer?"Back to events":"Back to home"}</Link>
        <header className="policy-heading"><span className="customer-icon"><Icon name="page" size={25}/></span><p className="customer-eyebrow">THE DETAILS THAT MATTER</p><h1>{page.title}</h1>{updated && Number.isFinite(updated.getTime()) && <p>Last updated {updated.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}</header>
        <article className="customer-policy-content" dangerouslySetInnerHTML={{ __html: page.body }}/>
        <Link className="customer-text-link policy-back" to={site.is_organizer?"/events":"/"}>Back to exploring <Icon name="arrow" size={17}/></Link>
      </div>
    </main>
  );
}
