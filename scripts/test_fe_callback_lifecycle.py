#!/usr/bin/env python3
"""Reproduce AP unregister with an outstanding flowtable callback reference."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'port/overlay/target/linux/rtl9617c/files-6.18/drivers/net/ethernet/realtek/rtl9617c-fe.c').read_text()

def function(name):
    start = source.rfind('\n', 0, source.index(name + '(')) + 1
    end = source.index('{', start) + 1
    depth = 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[start:end] + '\n'

common = r'''
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <errno.h>
#include <stdio.h>
struct list_head {struct list_head *next,*prev;};
#define container_of(p,t,m) ((t *)((char *)(p)-offsetof(t,m)))
#define list_for_each_entry(p,h,m) for(struct list_head *c=(h)->next;c!=(h) && ((p)=container_of(c,__typeof__(*(p)),m));c=c->next)
#define list_for_each_entry_safe(p,n,h,m) for(struct list_head *c=(h)->next,*nc=c->next;c!=(h) && ((p)=container_of(c,__typeof__(*(p)),m),(n)=container_of(nc,__typeof__(*(n)),m),1);c=nc,nc=c->next)
#define list_last_entry(h,t,m) container_of((h)->prev,t,m)
static void init(struct list_head *h){h->next=h->prev=h;}
static void list_add_tail(struct list_head *n,struct list_head *h){n->prev=h->prev;n->next=h;h->prev->next=n;h->prev=n;}
static void list_del(struct list_head *n){n->prev->next=n->next;n->next->prev=n->prev;}
enum tc_setup_type {TC_SETUP_FT};
enum {FLOW_BLOCK_BIND,FLOW_BLOCK_UNBIND,FLOW_BLOCK_BINDER_TYPE_CLSACT_INGRESS};
struct net_device {int id;};
struct rtl_fe;
struct rtl_fe_port {struct list_head list;struct rtl_fe *fe;struct net_device *netdev;unsigned int bindings;bool retired;};
struct rtl_fe_flow {struct list_head list;struct rtl_fe_port *input,*output;};
struct rtl_fe {struct list_head ports,flows,blocks;int lock;};
struct flow_block_cb {struct list_head list,driver_list;void *cb_priv;void (*release)(void *);};
struct flow_block_offload {int binder_type,command;struct list_head cb_list;struct flow_block_cb *bound;};
static unsigned int freed;
static void kfree(void *p){freed++;free(p);}
static void mutex_lock(int *p){assert(!*p);*p=1;}
static void mutex_unlock(int *p){assert(*p);*p=0;}
static int fe_block_callback(enum tc_setup_type t,void *d,void *p){(void)t;(void)d;return ((struct rtl_fe_port *)p)->fe->lock;}
static int flow_block_cb_setup_simple(struct flow_block_offload *b,struct list_head *l,
 int (*cb)(enum tc_setup_type,void *,void *),void *id,void *priv,bool ingress){
 (void)cb;(void)id;assert(ingress);
 if(b->command==FLOW_BLOCK_BIND){
  struct flow_block_cb *c=calloc(1,sizeof(*c));assert(c);c->cb_priv=priv;b->bound=c;
  list_add_tail(&c->list,&b->cb_list);list_add_tail(&c->driver_list,l);
 }else {list_del(&b->bound->driver_list);}
 return 0;
}
'''
test = r'''
int main(void){
 for(unsigned int i=0;i<1000;i++){
  struct rtl_fe fe={};struct net_device dev={};
  init(&fe.ports);init(&fe.flows);init(&fe.blocks);
  struct rtl_fe_port *port=calloc(1,sizeof(*port));assert(port);
  port->fe=&fe;port->netdev=&dev;list_add_tail(&port->list,&fe.ports);
  struct flow_block_offload block={.binder_type=FLOW_BLOCK_BINDER_TYPE_CLSACT_INGRESS};init(&block.cb_list);
  assert(!rtl_fe_setup_tc(&fe,&dev,TC_SETUP_FT,&block));assert(port->bindings==1 && block.bound->release);
  port->retired=true;fe_collect_ports(&fe);
  assert(fe.ports.next==&port->list && !fe_block_callback(TC_SETUP_FT,NULL,block.bound->cb_priv));
  block.command=FLOW_BLOCK_UNBIND;
  assert(!rtl_fe_setup_tc(&fe,&dev,TC_SETUP_FT,&block));fe_collect_ports(&fe);
  assert(port->bindings==1 && fe.ports.next==&port->list);
  block.bound->release(block.bound->cb_priv);free(block.bound);
  assert(fe.ports.next==&fe.ports && freed==i+1);
 }
 puts("FE callback lifetime: 1000 AP unregister/unbind cycles retain private state until flowtable release");
}
'''
with tempfile.TemporaryDirectory(prefix='fe-callback-', dir=root / 'artifacts') as directory:
    p = Path(directory)
    (p / 'test.c').write_text(common + ''.join(function(n) for n in
        ('fe_port', 'fe_collect_ports', 'fe_block_release', 'rtl_fe_setup_tc')) + test)
    subprocess.run(['cc', '-Wall', '-Wextra', '-Werror', '-fsanitize=address,undefined',
                    str(p / 'test.c'), '-o', str(p / 'test')], check=True)
    subprocess.run([str(p / 'test')], check=True)
